package metadata_test

import (
	"context"
	"slices"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/utils/ptr"
	"pgregory.net/rapid"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/testutils"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
)

// All tests must check the SQL and KV implementations.
func TestSecureValueStoreTestMachine(t *testing.T) {
	t.Parallel()

	t.Run("SQL backend", func(t *testing.T) {
		t.Parallel()
		runModelStateMachineTests(t)
	})

	t.Run("KV backend", func(t *testing.T) {
		t.Parallel()
		runModelStateMachineTests(t, testutils.WithKVStorage())
	})

	t.Run("SQL and KV backend behave the same", func(t *testing.T) {
		t.Parallel()
		runSutStateMachineTests(t)
	})
}

func runModelStateMachineTests(t *testing.T, opts ...func(*testutils.SetupConfig)) {
	tt := t
	rapid.Check(t, func(t *rapid.T) {
		sut := testutils.Setup(tt, opts...)
		model := testutils.NewModelGsm(sut.ModelSecretsManager)

		t.Repeat(map[string]func(*rapid.T){
			"createSecureValueWithSecretValue": func(t *rapid.T) {
				sv := testutils.AnySecureValueGen.Draw(t, "sv")

				modelCreatedSv, modelErr := model.Create(sut.Clock.Now(), sv.DeepCopy())
				createdSv, err := sut.CreateSv(t.Context(), testutils.CreateSvWithSv(sv.DeepCopy()))
				if err != nil || modelErr != nil {
					require.ErrorIs(t, err, modelErr)
					return
				}
				require.Equal(t, modelCreatedSv.Namespace, createdSv.Namespace)
				require.Equal(t, modelCreatedSv.Name, createdSv.Name)
				require.Equal(t, modelCreatedSv.Status.Version, createdSv.Status.Version)
			},
			"createSecureValueWithRef": func(t *rapid.T) {
				sv := testutils.AnySecureValueWithRefGen.Draw(t, "sv")

				modelCreatedSv, modelErr := model.Create(sut.Clock.Now(), sv.DeepCopy())
				createdSv, err := sut.CreateSv(t.Context(), testutils.CreateSvWithSv(sv.DeepCopy()))
				if err != nil || modelErr != nil {
					require.ErrorIs(t, err, modelErr)
					return
				}
				require.Equal(t, modelCreatedSv.Namespace, createdSv.Namespace)
				require.Equal(t, modelCreatedSv.Name, createdSv.Name)
				require.Equal(t, modelCreatedSv.Status.Version, createdSv.Status.Version)
			},
			"createSecretOn3rdPartyKeeper": func(t *rapid.T) {
				name := testutils.SecretsToRefGen.Draw(t, "name")
				value := rapid.String().Draw(t, "value")
				sut.ModelSecretsManager.Create(name, value)
			},
			"update": func(t *rapid.T) {
				sv := testutils.UpdateSecureValueGen.Draw(t, "sv")
				modelCreatedSv, _, modelErr := model.Update(sut.Clock.Now(), sv.DeepCopy())
				createdSv, err := sut.UpdateSv(t.Context(), sv.DeepCopy())
				if err != nil || modelErr != nil {
					require.ErrorIs(t, err, modelErr)
					return
				}
				require.Equal(t, modelCreatedSv.Namespace, createdSv.Namespace)
				require.Equal(t, modelCreatedSv.Name, createdSv.Name)
				require.Equal(t, modelCreatedSv.Status.Version, createdSv.Status.Version)
			},
			"delete": func(t *rapid.T) {
				ns := testutils.NamespaceGen.Draw(t, "ns")
				name := testutils.SecureValueNameGen.Draw(t, "name")
				modelSv, modelErr := model.Delete(ns, name)
				deletedSv, err := sut.DeleteSv(t.Context(), ns, name)
				if err != nil || modelErr != nil {
					require.ErrorIs(t, err, modelErr)
					return
				}
				require.Equal(t, modelSv.Namespace, deletedSv.Namespace)
				require.Equal(t, modelSv.Name, deletedSv.Name)
				require.Equal(t, modelSv.Status.Version, deletedSv.Status.Version)
			},
			"list": func(t *rapid.T) {
				ns := testutils.NamespaceGen.Draw(t, "ns")
				authCtx := testutils.CreateUserAuthContext(t.Context(), ns, map[string][]string{
					"securevalues:read": {"securevalues:uid:*"},
				})
				modelList, modelErr := model.List(ns)
				list, err := sut.SecureValueService.List(authCtx, xkube.Namespace(ns))
				if err != nil || modelErr != nil {
					require.ErrorIs(t, err, modelErr)
					return
				}

				require.Equal(t, len(modelList.Items), len(list.Items))

				// PERFORMANCE: The lists are always small
				for _, v1 := range modelList.Items {
					if !slices.ContainsFunc(list.Items, func(v2 secretv1beta1.SecureValue) bool {
						return v2.Namespace == v1.Namespace && v2.Name == v1.Name && v2.Status.Version == v1.Status.Version
					}) {
						t.Fatalf("expected sut to return secure value ns=%+v name=%+v version=%+v in the result",
							v1.Namespace, v1.Name, v1.Status.Version)
					}
				}
			},
			"get": func(t *rapid.T) {
				ns := testutils.NamespaceGen.Draw(t, "ns")
				name := testutils.SecureValueNameGen.Draw(t, "name")
				modelSv, modelErr := model.Read(ns, name)
				readSv, err := sut.SecureValueService.Read(t.Context(), xkube.Namespace(ns), name)
				if err != nil || modelErr != nil {
					require.ErrorIs(t, err, modelErr)
					return
				}
				require.Equal(t, modelSv.Namespace, readSv.Namespace)
				require.Equal(t, modelSv.Name, readSv.Name)
				require.Equal(t, modelSv.Status.Version, readSv.Status.Version)
			},
			"decrypt": func(t *rapid.T) {
				input := testutils.DecryptGen.Draw(t, "decryptInput")
				modelResult, modelErr := model.Decrypt(t.Context(), input.Decrypter, input.Namespace, input.Name)
				result, err := sut.DecryptService.Decrypt(t.Context(), input.Decrypter, input.Namespace, input.Name)
				if err != nil || modelErr != nil {
					require.ErrorIs(t, err, modelErr)
					return
				}

				require.Equal(t, len(modelResult), len(result))
				for name := range modelResult {
					require.ErrorIs(t, modelResult[name].Error(), result[name].Error())
					require.Equal(t, modelResult[name].Value(), result[name].Value())
				}
			},
			"createKeeper": func(t *rapid.T) {
				input := testutils.AnyKeeperGen.Draw(t, "keeper")
				modelKeeper, modelErr := model.CreateKeeper(input)
				keeper, err := sut.KeeperMetadataStorage.Create(t.Context(), input, "actor-uid")
				if err != nil || modelErr != nil {
					require.ErrorIs(t, err, modelErr)
					return
				}
				require.Equal(t, modelKeeper.Name, keeper.Name)
			},
			"setKeeperAsActive": func(t *rapid.T) {
				namespace := testutils.NamespaceGen.Draw(t, "namespace")
				var keeper string
				if rapid.Bool().Draw(t, "systemKeeper") {
					keeper = contracts.SystemKeeperName
				} else {
					keeper = testutils.KeeperNameGen.Draw(t, "keeper")
				}
				modelErr := model.SetKeeperAsActive(namespace, keeper)
				err := sut.KeeperMetadataStorage.SetAsActive(t.Context(), xkube.Namespace(namespace), keeper)
				if err != nil || modelErr != nil {
					require.ErrorIs(t, err, modelErr)
					return
				}
			},
			"setInactiveAllFromGroup": func(t *rapid.T) {
				// TODO: implement
			},
			"leaseInactiveSecureValues": func(t *rapid.T) {
				// TODO: implement
			},
			"incGCAttemptCount": func(t *rapid.T) {
				// TODO: implement
			},
		})
	})
}

func runSutStateMachineTests(t *testing.T) {
	tt := t
	rapid.Check(t, func(t *rapid.T) {
		sut := testutils.Setup(tt)
		model := testutils.Setup(tt, testutils.WithKVStorage())

		t.Repeat(map[string]func(*rapid.T){
			"createSecureValueWithSecretValue": func(t *rapid.T) {
				sv := testutils.AnySecureValueGen.Draw(t, "sv")

				modelCreatedSv, modelErr := model.CreateSv(t.Context(), testutils.CreateSvWithSv(sv.DeepCopy()))
				createdSv, err := sut.CreateSv(t.Context(), testutils.CreateSvWithSv(sv.DeepCopy()))
				if err != nil || modelErr != nil {
					require.EqualValues(t, err, modelErr)
					return
				}
				require.Equal(t, modelCreatedSv.Namespace, createdSv.Namespace)
				require.Equal(t, modelCreatedSv.Name, createdSv.Name)
				require.Equal(t, modelCreatedSv.Status.Version, createdSv.Status.Version)
			},
			"createSecureValueWithRef": func(t *rapid.T) {
				sv := testutils.AnySecureValueWithRefGen.Draw(t, "sv")

				modelCreatedSv, modelErr := model.CreateSv(t.Context(), testutils.CreateSvWithSv(sv.DeepCopy()))
				createdSv, err := sut.CreateSv(t.Context(), testutils.CreateSvWithSv(sv.DeepCopy()))
				if err != nil || modelErr != nil {
					require.Equal(t, err.Error(), modelErr.Error())
					return
				}
				require.Equal(t, modelCreatedSv.Namespace, createdSv.Namespace)
				require.Equal(t, modelCreatedSv.Name, createdSv.Name)
				require.Equal(t, modelCreatedSv.Status.Version, createdSv.Status.Version)
			},
			"createSecretOn3rdPartyKeeper": func(t *rapid.T) {
				name := testutils.SecretsToRefGen.Draw(t, "name")
				value := rapid.String().Draw(t, "value")
				sut.ModelSecretsManager.Create(name, value)
			},
			"update": func(t *rapid.T) {
				sv := testutils.UpdateSecureValueGen.Draw(t, "sv")
				modelCreatedSv, modelErr := model.UpdateSv(t.Context(), sv.DeepCopy())
				createdSv, err := sut.UpdateSv(t.Context(), sv.DeepCopy())
				if err != nil || modelErr != nil {
					require.Equal(t, err.Error(), modelErr.Error())
					return
				}
				require.Equal(t, modelCreatedSv.Namespace, createdSv.Namespace)
				require.Equal(t, modelCreatedSv.Name, createdSv.Name)
				require.Equal(t, modelCreatedSv.Status.Version, createdSv.Status.Version)
			},
			"delete": func(t *rapid.T) {
				ns := testutils.NamespaceGen.Draw(t, "ns")
				name := testutils.SecureValueNameGen.Draw(t, "name")
				modelSv, modelErr := model.DeleteSv(t.Context(), ns, name)
				deletedSv, err := sut.DeleteSv(t.Context(), ns, name)
				if err != nil || modelErr != nil {
					require.Equal(t, err.Error(), modelErr.Error())
					return
				}
				require.Equal(t, modelSv.Namespace, deletedSv.Namespace)
				require.Equal(t, modelSv.Name, deletedSv.Name)
				require.Equal(t, modelSv.Status.Version, deletedSv.Status.Version)
			},
			"list": func(t *rapid.T) {
				ns := testutils.NamespaceGen.Draw(t, "ns")
				authCtx := testutils.CreateUserAuthContext(t.Context(), ns, map[string][]string{
					"securevalues:read": {"securevalues:uid:*"},
				})
				modelList, modelErr := model.SecureValueService.List(authCtx, xkube.Namespace(ns))
				list, err := sut.SecureValueService.List(authCtx, xkube.Namespace(ns))
				if err != nil || modelErr != nil {
					require.Equal(t, err.Error(), modelErr.Error())
					return
				}

				require.Equal(t, len(modelList.Items), len(list.Items))

				// PERFORMANCE: The lists are always small
				for _, v1 := range modelList.Items {
					if !slices.ContainsFunc(list.Items, func(v2 secretv1beta1.SecureValue) bool {
						return v2.Namespace == v1.Namespace && v2.Name == v1.Name && v2.Status.Version == v1.Status.Version
					}) {
						t.Fatalf("expected sut to return secure value ns=%+v name=%+v version=%+v in the result",
							v1.Namespace, v1.Name, v1.Status.Version)
					}
				}
			},
			"get": func(t *rapid.T) {
				ns := testutils.NamespaceGen.Draw(t, "ns")
				name := testutils.SecureValueNameGen.Draw(t, "name")
				modelSv, modelErr := model.SecureValueService.Read(t.Context(), xkube.Namespace(ns), name)
				readSv, err := sut.SecureValueService.Read(t.Context(), xkube.Namespace(ns), name)
				if err != nil || modelErr != nil {
					require.Equal(t, err.Error(), modelErr.Error())
					return
				}
				require.Equal(t, modelSv.Namespace, readSv.Namespace)
				require.Equal(t, modelSv.Name, readSv.Name)
				require.Equal(t, modelSv.Status.Version, readSv.Status.Version)
			},
			"decrypt": func(t *rapid.T) {
				input := testutils.DecryptGen.Draw(t, "decryptInput")
				modelResult, modelErr := model.DecryptService.Decrypt(t.Context(), input.Decrypter, input.Namespace, input.Name)
				result, err := sut.DecryptService.Decrypt(t.Context(), input.Decrypter, input.Namespace, input.Name)
				if err != nil || modelErr != nil {
					require.Equal(t, err.Error(), modelErr.Error())
					return
				}

				require.Equal(t, len(modelResult), len(result))
				for name := range modelResult {
					require.EqualValues(t, modelResult[name].Error(), result[name].Error())
					require.Equal(t, modelResult[name].Value(), result[name].Value())
				}
			},
			"createKeeper": func(t *rapid.T) {
				input := testutils.AnyKeeperGen.Draw(t, "keeper")
				modelKeeper, modelErr := model.KeeperMetadataStorage.Create(t.Context(), input, "actor-uid")
				keeper, err := sut.KeeperMetadataStorage.Create(t.Context(), input, "actor-uid")
				if err != nil || modelErr != nil {
					require.Equal(t, err.Error(), modelErr.Error())
					return
				}
				require.Equal(t, modelKeeper.Name, keeper.Name)
			},
			"setKeeperAsActive": func(t *rapid.T) {
				namespace := testutils.NamespaceGen.Draw(t, "namespace")
				var keeper string
				if rapid.Bool().Draw(t, "systemKeeper") {
					keeper = contracts.SystemKeeperName
				} else {
					keeper = testutils.KeeperNameGen.Draw(t, "keeper")
				}
				modelErr := model.KeeperMetadataStorage.SetAsActive(t.Context(), xkube.Namespace(namespace), keeper)
				err := sut.KeeperMetadataStorage.SetAsActive(t.Context(), xkube.Namespace(namespace), keeper)
				if err != nil || modelErr != nil {
					require.Equal(t, err.Error(), modelErr.Error())
					return
				}
			},
			"setInactiveAllFromGroup": func(t *rapid.T) {
				namespace := testutils.NamespaceGen.Draw(t, "namespace")
				apiGroup := testutils.APIGroupGen.Draw(t, "apiGroup")
				modelErr := model.SecureValueMetadataStorage.SetInactiveAllFromGroup(t.Context(), xkube.Namespace(namespace), apiGroup)
				err := sut.SecureValueMetadataStorage.SetInactiveAllFromGroup(t.Context(), xkube.Namespace(namespace), apiGroup)
				if err != nil || modelErr != nil {
					require.Equal(t, err.Error(), modelErr.Error())
					return
				}
			},
			"leaseInactiveSecureValues": func(t *rapid.T) {
				maxBatchSize := rapid.Uint16().Draw(t, "maxBatchSize")
				modelSecureValues, modelErr := model.SecureValueMetadataStorage.LeaseInactiveSecureValues(t.Context(), maxBatchSize)
				secureValues, err := sut.SecureValueMetadataStorage.LeaseInactiveSecureValues(t.Context(), maxBatchSize)
				if err != nil || modelErr != nil {
					require.Equal(t, err.Error(), modelErr.Error())
					return
				}
				require.Equal(t, modelSecureValues, secureValues)
			},
			"incGCAttemptCount": func(t *rapid.T) {
				input := rapid.SliceOf(rapid.Custom(func(t *rapid.T) contracts.SecureValueIdentifier {
					return contracts.SecureValueIdentifier{
						Namespace: xkube.Namespace(testutils.NamespaceGen.Draw(t, "namespace")),
						Name:      testutils.SecureValueNameGen.Draw(t, "name"),
						Version:   int64(rapid.IntRange(1, 10).Draw(t, "version")),
					}
				})).Draw(t, "secureValues")
				modelSecureValues, modelErr := model.SecureValueMetadataStorage.IncGCAttemptCount(t.Context(), input)
				secureValues, err := sut.SecureValueMetadataStorage.IncGCAttemptCount(t.Context(), input)
				if err != nil || modelErr != nil {
					require.Equal(t, err.Error(), modelErr.Error())
					return
				}
				require.Equal(t, modelSecureValues, secureValues)
			},
		})
	})
}

// All tests must check the SQL and KV implementations.
func TestExampleBased(t *testing.T) {
	t.Parallel()

	t.Run("SQL backend", func(t *testing.T) {
		t.Parallel()
		runExampleBasedTests(t)
	})

	t.Run("KV backend", func(t *testing.T) {
		t.Parallel()
		runExampleBasedTests(t, testutils.WithKVStorage())
	})
}

func runExampleBasedTests(t *testing.T, opts ...func(*testutils.SetupConfig)) {
	t.Run("shouldn't be able to decrypt using deleted secure value", func(t *testing.T) {
		t.Parallel()

		sut := testutils.Setup(t, opts...)

		sv, err := sut.CreateSv(t.Context())
		require.NoError(t, err)

		readSv, err := sut.SecureValueService.Read(t.Context(), xkube.Namespace(sv.Namespace), sv.Name)
		require.NoError(t, err)
		require.Equal(t, sv.Status.Version, readSv.Status.Version)

		deletedSv, err := sut.DeleteSv(t.Context(), sv.Namespace, sv.Name)
		require.NoError(t, err)
		require.Equal(t, sv.Status.Version, deletedSv.Status.Version)

		result, err := sut.DecryptService.Decrypt(t.Context(), sv.Spec.Decrypters[0], sv.Namespace, sv.Name)
		require.NoError(t, err)
		require.Equal(t, 1, len(result))
		require.ErrorIs(t, result[sv.Name].Error(), contracts.ErrDecryptNotFound)
	})

	t.Run("should be able to use secrets that were created with a keeper that's inactive", func(t *testing.T) {
		t.Parallel()

		sut := testutils.Setup(t)

		// - Create a secret with k1
		k1, err := sut.KeeperMetadataStorage.Create(t.Context(), &secretv1beta1.Keeper{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: "n1",
				Name:      "k1",
			},
			Spec: secretv1beta1.KeeperSpec{
				Description: "description",
				Aws:         &secretv1beta1.KeeperAWSConfig{},
			},
		}, "actor-uid")
		require.NoError(t, err)

		require.NoError(t, sut.KeeperMetadataStorage.SetAsActive(t.Context(), xkube.Namespace(k1.Namespace), k1.Name))

		value := secretv1beta1.NewExposedSecureValue("v1")
		sv1, err := sut.CreateSv(t.Context(), testutils.CreateSvWithSv(&secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{Namespace: k1.Namespace, Name: "s1"},
			Spec: secretv1beta1.SecureValueSpec{
				Description: "desc",
				Value:       &value,
			},
		}))
		require.NoError(t, err)
		require.Equal(t, k1.Name, sv1.Status.Keeper)

		// - Set a new keeper as active
		k2, err := sut.KeeperMetadataStorage.Create(t.Context(), &secretv1beta1.Keeper{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: "n1",
				Name:      "k2",
			},
			Spec: secretv1beta1.KeeperSpec{
				Description: "description",
				Aws:         &secretv1beta1.KeeperAWSConfig{},
			},
		}, "actor-uid")
		require.NoError(t, err)
		require.NoError(t, sut.KeeperMetadataStorage.SetAsActive(t.Context(), xkube.Namespace(k2.Namespace), k2.Name))

		// - Read secure value created with inactive keeper
		readSv, err := sut.SecureValueService.Read(t.Context(), xkube.Namespace(sv1.Namespace), sv1.Name)
		require.NoError(t, err)
		require.Equal(t, sv1.Namespace, readSv.Namespace)
		require.Equal(t, sv1.Name, readSv.Name)
		require.Equal(t, k1.Name, readSv.Status.Keeper)

		// - Update secure value created with inactive keeper
		newSv1 := sv1.DeepCopy()
		newSv1.Spec.Description = "updated desc"
		updatedSv, _, err := sut.SecureValueService.Update(t.Context(), newSv1, "actor-uid")
		require.NoError(t, err)
		require.Equal(t, sv1.Namespace, updatedSv.Namespace)
		require.Equal(t, sv1.Name, updatedSv.Name)
		require.Equal(t, k1.Name, updatedSv.Status.Keeper)
		require.Equal(t, newSv1.Spec.Description, updatedSv.Spec.Description)
	})
}

// The Grafana Secrets Manager model is used for checking against the real system.
// Example based tests to ensure the model behaves correctly.
func TestModelExampleBased(t *testing.T) {
	t.Parallel()

	sv := &secretv1beta1.SecureValue{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "sv1",
			Namespace: "ns1",
		},
		Spec: secretv1beta1.SecureValueSpec{
			Description: "desc1",
			Value:       new(secretv1beta1.NewExposedSecureValue("v1")),
			Decrypters:  []string{"decrypter1"},
		},
		Status: secretv1beta1.SecureValueStatus{},
	}

	t.Run("creating secure values", func(t *testing.T) {
		t.Parallel()

		m := testutils.NewModelGsm(nil)
		now := time.Now()

		// Create a secure value
		sv1, err := m.Create(now, sv.DeepCopy())
		require.NoError(t, err)
		require.Equal(t, sv.Namespace, sv1.Namespace)
		require.Equal(t, sv.Name, sv1.Name)
		require.EqualValues(t, 1, sv1.Status.Version)

		// Create a new version of a secure value
		sv2, err := m.Create(now, sv.DeepCopy())
		require.NoError(t, err)
		require.Equal(t, sv.Namespace, sv2.Namespace)
		require.Equal(t, sv.Name, sv2.Name)
		require.EqualValues(t, 2, sv2.Status.Version)
	})

	t.Run("updating secure values", func(t *testing.T) {
		t.Parallel()

		m := testutils.NewModelGsm(nil)

		now := time.Now()

		sv1, err := m.Create(now, sv.DeepCopy())
		require.NoError(t, err)

		// Create a new version of a secure value by updating it
		sv2, _, err := m.Update(now, sv1.DeepCopy())
		require.NoError(t, err)
		require.Equal(t, sv.Namespace, sv2.Namespace)
		require.Equal(t, sv.Name, sv2.Name)
		require.EqualValues(t, 2, sv2.Status.Version)

		// Try updating a secure value that doesn't exist without specifying a value for it
		sv3 := sv2.DeepCopy()
		sv3.Name = "i_dont_exist"
		sv3.Spec.Value = nil
		_, _, err = m.Update(now, sv3)
		require.ErrorIs(t, err, contracts.ErrSecureValueNotFound)

		// Updating a value that doesn't exist creates a new version
		sv4 := sv3.DeepCopy()
		sv4.Name = "i_dont_exist"
		sv4.Spec.Value = new(secretv1beta1.NewExposedSecureValue("sv4"))
		_, _, err = m.Update(now, sv4)
		require.ErrorIs(t, err, contracts.ErrSecureValueNotFound)
	})

	t.Run("deleting a secure value", func(t *testing.T) {
		t.Parallel()

		m := testutils.NewModelGsm(nil)
		now := time.Now()

		sv1, err := m.Create(now, sv.DeepCopy())
		require.NoError(t, err)

		// Deleting a secure value
		deletedSv, err := m.Delete(sv1.Namespace, sv1.Name)
		require.NoError(t, err)
		require.Equal(t, sv1.Namespace, deletedSv.Namespace)
		require.Equal(t, sv1.Name, deletedSv.Name)
		require.EqualValues(t, sv1.Status.Version, deletedSv.Status.Version)

		// Deleting a secure value that doesn't exist results in an error
		_, err = m.Delete(sv1.Namespace, sv1.Name)
		require.ErrorIs(t, err, contracts.ErrSecureValueNotFound)
	})

	t.Run("listing secure values", func(t *testing.T) {
		t.Parallel()

		m := testutils.NewModelGsm(nil)
		now := time.Now()

		// No secure values exist yet
		list, err := m.List(sv.Namespace)
		require.NoError(t, err)
		require.Equal(t, 0, len(list.Items))

		// Create a secure value
		sv1, err := m.Create(now, sv.DeepCopy())
		require.NoError(t, err)

		// 1 secure value exists and it should be returned
		list, err = m.List(sv.Namespace)
		require.NoError(t, err)
		require.Equal(t, 1, len(list.Items))
		require.Equal(t, sv1.Namespace, list.Items[0].Namespace)
		require.Equal(t, sv1.Name, list.Items[0].Name)
		require.EqualValues(t, sv1.Status.Version, list.Items[0].Status.Version)
	})

	t.Run("decrypting secure values", func(t *testing.T) {
		t.Parallel()

		m := testutils.NewModelGsm(nil)
		now := time.Now()

		// Decrypting a secure value that does not exist
		result, err := m.Decrypt(t.Context(), "decrypter", "namespace", "name")
		require.NoError(t, err)
		require.Equal(t, 1, len(result))
		require.Nil(t, result["name"].Value())
		require.ErrorIs(t, result["name"].Error(), contracts.ErrDecryptNotFound)

		// Create a secure value
		secret := "v1"
		sv1, err := m.Create(now, sv.DeepCopy())
		require.NoError(t, err)

		// Decrypt the just created secure value
		result, err = m.Decrypt(t.Context(), sv1.Spec.Decrypters[0], sv1.Namespace, sv1.Name)
		require.NoError(t, err)
		require.Equal(t, 1, len(result))
		require.Nil(t, result[sv1.Name].Error())
		require.Equal(t, secret, result[sv1.Name].Value().DangerouslyExposeAndConsumeValue())
	})

	t.Run("decrypting with reference", func(t *testing.T) {
		t.Parallel()

		secretsManager := testutils.NewModelSecretsManager()
		m := testutils.NewModelGsm(secretsManager)
		now := time.Now()

		keeper, err := m.CreateKeeper(&secretv1beta1.Keeper{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: "ns1",
				Name:      "k1",
			},
			Spec: secretv1beta1.KeeperSpec{
				Aws: &secretv1beta1.KeeperAWSConfig{},
			},
		})
		require.NoError(t, err)
		require.NoError(t, m.SetKeeperAsActive(keeper.Namespace, keeper.Name))

		// Store the secret on the 3rd party secrets store
		secret := "v1"
		secretsManager.Create("ref1", secret)

		// Create a secure value that references the secret on the 3rd party secret store
		sv, err := m.Create(now, &secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "sv1",
				Namespace: "ns1",
			},
			Spec: secretv1beta1.SecureValueSpec{
				Description: "desc1",
				Ref:         new("ref1"),
				Decrypters:  []string{"decrypter1"},
			},
			Status: secretv1beta1.SecureValueStatus{},
		})
		require.NoError(t, err)

		// Decrypt the just created secure value
		result, err := m.Decrypt(t.Context(), sv.Spec.Decrypters[0], sv.Namespace, sv.Name)
		require.NoError(t, err)
		require.Equal(t, 1, len(result))
		require.Nil(t, result[sv.Name].Error())
		require.Equal(t, secret, result[sv.Name].Value().DangerouslyExposeAndConsumeValue())
	})
}

// ###
// ### KV storage backend specific tests
// ###

func Test_KV_SecureValueMetadataStorage_CreateAndRead(t *testing.T) {
	ctx := context.Background()
	sut := testutils.Setup(t, testutils.WithKVStorage())

	t.Run("create and read a secure value", func(t *testing.T) {
		testSecureValue := &secretv1beta1.SecureValue{
			Spec: secretv1beta1.SecureValueSpec{
				Description: "test description",
				Value:       ptr.To(secretv1beta1.NewExposedSecureValue("test-value")),
			},
		}
		testSecureValue.Name = "sv-test"
		testSecureValue.Namespace = "default"

		// Create the secure value
		createdSecureValue, err := sut.SecureValueMetadataStorage.Create(ctx, "test-keeper", testSecureValue, "testuser")
		require.NoError(t, err)
		require.NotNil(t, createdSecureValue)
		require.Equal(t, "sv-test", createdSecureValue.Name)
		require.Equal(t, "default", createdSecureValue.Namespace)
		require.Equal(t, "test description", createdSecureValue.Spec.Description)
		require.Equal(t, "test-keeper", createdSecureValue.Status.Keeper)
		require.Equal(t, int64(1), createdSecureValue.Status.Version)

		// Set version to active (this is what the service does)
		err = sut.SecureValueMetadataStorage.SetVersionToActive(ctx, xkube.Namespace("default"), "sv-test", createdSecureValue.Status.Version)
		require.NoError(t, err)

		// Read the secure value back
		readSecureValue, err := sut.SecureValueMetadataStorage.Read(ctx, xkube.Namespace("default"), "sv-test", contracts.ReadOpts{})
		require.NoError(t, err)
		require.NotNil(t, readSecureValue)
		require.Equal(t, "sv-test", readSecureValue.Name)
		require.Equal(t, "default", readSecureValue.Namespace)
		require.Equal(t, "test description", readSecureValue.Spec.Description)
		require.Equal(t, "test-keeper", readSecureValue.Status.Keeper)

		// List secure values and verify our value is in the list
		secureValues, err := sut.SecureValueMetadataStorage.List(ctx, xkube.Namespace("default"))
		require.NoError(t, err)
		require.NotEmpty(t, secureValues)

		// Find our secure value in the list
		var found bool
		for _, sv := range secureValues {
			if sv.Name == "sv-test" {
				found = true
				require.Equal(t, "default", sv.Namespace)
				require.Equal(t, "test description", sv.Spec.Description)
				require.Equal(t, "test-keeper", sv.Status.Keeper)
				break
			}
		}
		require.True(t, found, "secure value not found in list")
	})

	t.Run("create, read, delete and verify secure value", func(t *testing.T) {
		testSecureValue := &secretv1beta1.SecureValue{
			Spec: secretv1beta1.SecureValueSpec{
				Description: "test description 2",
				Value:       ptr.To(secretv1beta1.NewExposedSecureValue("test-value-2")),
			},
		}
		testSecureValue.Name = "sv-test-2"
		testSecureValue.Namespace = "default"

		// Create the secure value
		createdSecureValue, err := sut.SecureValueMetadataStorage.Create(ctx, "test-keeper", testSecureValue, "testuser")
		require.NoError(t, err)
		require.NotNil(t, createdSecureValue)

		// Set version to active
		err = sut.SecureValueMetadataStorage.SetVersionToActive(ctx, xkube.Namespace("default"), "sv-test-2", createdSecureValue.Status.Version)
		require.NoError(t, err)

		// Read the secure value to verify it exists
		readSecureValue, err := sut.SecureValueMetadataStorage.Read(ctx, xkube.Namespace("default"), "sv-test-2", contracts.ReadOpts{})
		require.NoError(t, err)
		require.NotNil(t, readSecureValue)
		require.Equal(t, "sv-test-2", readSecureValue.Name)

		// Set the version to inactive
		err = sut.SecureValueMetadataStorage.SetVersionToInactive(ctx, xkube.Namespace("default"), "sv-test-2", readSecureValue.Status.Version)
		require.NoError(t, err)

		// Try to read the deleted secure value - should return error
		_, err = sut.SecureValueMetadataStorage.Read(ctx, xkube.Namespace("default"), "sv-test-2", contracts.ReadOpts{})
		require.Error(t, err)
		require.Equal(t, contracts.ErrSecureValueNotFound, err)
	})

	t.Run("create multiple versions", func(t *testing.T) {
		testSecureValue := &secretv1beta1.SecureValue{
			Spec: secretv1beta1.SecureValueSpec{
				Description: "version 1",
				Value:       ptr.To(secretv1beta1.NewExposedSecureValue("v1")),
			},
		}
		testSecureValue.Name = "sv-multi"
		testSecureValue.Namespace = "default"

		// Create version 1
		v1, err := sut.SecureValueMetadataStorage.Create(ctx, "test-keeper", testSecureValue, "testuser")
		require.NoError(t, err)
		require.Equal(t, int64(1), v1.Status.Version)
		err = sut.SecureValueMetadataStorage.SetVersionToActive(ctx, xkube.Namespace("default"), "sv-multi", v1.Status.Version)
		require.NoError(t, err)

		// Create version 2
		testSecureValue.Spec.Description = "version 2"
		v2, err := sut.SecureValueMetadataStorage.Create(ctx, "test-keeper", testSecureValue, "testuser")
		require.NoError(t, err)
		require.Equal(t, int64(2), v2.Status.Version)
		err = sut.SecureValueMetadataStorage.SetVersionToActive(ctx, xkube.Namespace("default"), "sv-multi", v2.Status.Version)
		require.NoError(t, err)

		// Read should return the latest active version (v2)
		readSecureValue, err := sut.SecureValueMetadataStorage.Read(ctx, xkube.Namespace("default"), "sv-multi", contracts.ReadOpts{})
		require.NoError(t, err)
		require.Equal(t, "version 2", readSecureValue.Spec.Description)
		require.Equal(t, int64(2), readSecureValue.Status.Version)
	})
}

func Test_KV_SetExternalID(t *testing.T) {
	ctx := context.Background()
	sut := testutils.Setup(t, testutils.WithKVStorage())

	testSecureValue := &secretv1beta1.SecureValue{
		Spec: secretv1beta1.SecureValueSpec{
			Description: "test",
			Value:       ptr.To(secretv1beta1.NewExposedSecureValue("value")),
		},
	}
	testSecureValue.Name = "sv-external"
	testSecureValue.Namespace = "default"

	created, err := sut.SecureValueMetadataStorage.Create(ctx, "test-keeper", testSecureValue, "testuser")
	require.NoError(t, err)

	// Set version to active
	err = sut.SecureValueMetadataStorage.SetVersionToActive(ctx, xkube.Namespace("default"), "sv-external", created.Status.Version)
	require.NoError(t, err)

	// Set external ID
	externalID := contracts.ExternalID("external-123")
	err = sut.SecureValueMetadataStorage.SetExternalID(ctx, xkube.Namespace("default"), "sv-external", created.Status.Version, externalID)
	require.NoError(t, err)

	// Read and verify external ID
	read, err := sut.SecureValueMetadataStorage.Read(ctx, xkube.Namespace("default"), "sv-external", contracts.ReadOpts{})
	require.NoError(t, err)
	require.Equal(t, "external-123", read.Status.ExternalID)
}

func Test_KV_SetVersionToActive(t *testing.T) {
	ctx := context.Background()
	sut := testutils.Setup(t, testutils.WithKVStorage())

	testSecureValue := &secretv1beta1.SecureValue{
		Spec: secretv1beta1.SecureValueSpec{
			Description: "v1",
		},
	}
	testSecureValue.Name = "sv-active"
	testSecureValue.Namespace = "default"

	// Create two versions
	v1, err := sut.SecureValueMetadataStorage.Create(ctx, "test-keeper", testSecureValue, "testuser")
	require.NoError(t, err)
	err = sut.SecureValueMetadataStorage.SetVersionToActive(ctx, xkube.Namespace("default"), "sv-active", v1.Status.Version)
	require.NoError(t, err)

	testSecureValue.Spec.Description = "v2"
	v2, err := sut.SecureValueMetadataStorage.Create(ctx, "test-keeper", testSecureValue, "testuser")
	require.NoError(t, err)
	err = sut.SecureValueMetadataStorage.SetVersionToActive(ctx, xkube.Namespace("default"), "sv-active", v2.Status.Version)
	require.NoError(t, err)

	// Currently v2 should be active
	read, err := sut.SecureValueMetadataStorage.Read(ctx, xkube.Namespace("default"), "sv-active", contracts.ReadOpts{})
	require.NoError(t, err)
	require.Equal(t, "v2", read.Spec.Description)

	// Set v1 as active
	err = sut.SecureValueMetadataStorage.SetVersionToActive(ctx, xkube.Namespace("default"), "sv-active", v1.Status.Version)
	require.NoError(t, err)

	// Now v1 should be active
	read, err = sut.SecureValueMetadataStorage.Read(ctx, xkube.Namespace("default"), "sv-active", contracts.ReadOpts{})
	require.NoError(t, err)
	require.Equal(t, "v1", read.Spec.Description)
	require.Equal(t, v1.Status.Version, read.Status.Version)
}

func Test_KV_LeaseInactiveSecureValues(t *testing.T) {
	ctx := context.Background()
	sut := testutils.Setup(t, testutils.WithKVStorage())

	t.Run("no secure value exists", func(t *testing.T) {
		svs, err := sut.SecureValueMetadataStorage.LeaseInactiveSecureValues(ctx, 10)
		require.NoError(t, err)
		require.Empty(t, svs)
	})

	t.Run("lease inactive secure values", func(t *testing.T) {
		testSecureValue := &secretv1beta1.SecureValue{
			Spec: secretv1beta1.SecureValueSpec{
				Description: "test",
			},
		}
		testSecureValue.Name = "sv-lease"
		testSecureValue.Namespace = "default"

		// Create and then deactivate
		created, err := sut.SecureValueMetadataStorage.Create(ctx, "test-keeper", testSecureValue, "testuser")
		require.NoError(t, err)

		err = sut.SecureValueMetadataStorage.SetVersionToInactive(ctx, xkube.Namespace("default"), "sv-lease", created.Status.Version)
		require.NoError(t, err)

		// Advance clock to pass min age
		sut.Clock.AdvanceBy(10 * time.Minute)

		// Acquire a lease
		values1, err := sut.SecureValueMetadataStorage.LeaseInactiveSecureValues(ctx, 10)
		require.NoError(t, err)
		require.Equal(t, 1, len(values1))
		require.Equal(t, "sv-lease", values1[0].Name)

		// Try to acquire a lease again - should be empty since it's already leased
		values2, err := sut.SecureValueMetadataStorage.LeaseInactiveSecureValues(ctx, 10)
		require.NoError(t, err)
		require.Empty(t, values2)

		// Advance clock to expire lease
		sut.Clock.AdvanceBy(5 * time.Minute)

		// Should be able to acquire a new lease
		values3, err := sut.SecureValueMetadataStorage.LeaseInactiveSecureValues(ctx, 10)
		require.NoError(t, err)
		require.Equal(t, 1, len(values3))
		require.Equal(t, "sv-lease", values3[0].Name)
	})
}

func Test_KV_Delete(t *testing.T) {
	ctx := context.Background()
	sut := testutils.Setup(t, testutils.WithKVStorage())

	testSecureValue := &secretv1beta1.SecureValue{
		Spec: secretv1beta1.SecureValueSpec{
			Description: "test",
		},
	}
	testSecureValue.Name = "sv-delete"
	testSecureValue.Namespace = "default"

	created, err := sut.SecureValueMetadataStorage.Create(ctx, "test-keeper", testSecureValue, "testuser")
	require.NoError(t, err)

	// Delete the secure value
	err = sut.SecureValueMetadataStorage.Delete(ctx, []contracts.SecureValueIdentifier{{
		Namespace: xkube.Namespace(created.Namespace),
		Name:      "sv-delete",
		Version:   created.Status.Version,
	}})
	require.NoError(t, err)

	// Deleting again should be idempotent
	err = sut.SecureValueMetadataStorage.Delete(ctx, []contracts.SecureValueIdentifier{{
		Namespace: xkube.Namespace(created.Namespace),
		Name:      "sv-delete",
		Version:   created.Status.Version,
	}})
	require.NoError(t, err)
}

func Test_KV_List(t *testing.T) {
	ctx := context.Background()
	sut := testutils.Setup(t, testutils.WithKVStorage())

	// Create multiple secure values in different namespaces
	for i := range 3 {
		sv := &secretv1beta1.SecureValue{
			Spec: secretv1beta1.SecureValueSpec{
				Description: "test",
			},
		}
		svName := "sv-" + string(rune('a'+i))
		sv.Name = svName
		sv.Namespace = "ns1"

		created, err := sut.SecureValueMetadataStorage.Create(ctx, "test-keeper", sv, "testuser")
		require.NoError(t, err)
		err = sut.SecureValueMetadataStorage.SetVersionToActive(ctx, xkube.Namespace("ns1"), svName, created.Status.Version)
		require.NoError(t, err)
	}

	// Create in another namespace
	sv := &secretv1beta1.SecureValue{
		Spec: secretv1beta1.SecureValueSpec{
			Description: "test",
		},
	}
	sv.Name = "sv-other"
	sv.Namespace = "ns2"
	created, err := sut.SecureValueMetadataStorage.Create(ctx, "test-keeper", sv, "testuser")
	require.NoError(t, err)
	err = sut.SecureValueMetadataStorage.SetVersionToActive(ctx, xkube.Namespace("ns2"), "sv-other", created.Status.Version)
	require.NoError(t, err)

	// List ns1
	list1, err := sut.SecureValueMetadataStorage.List(ctx, xkube.Namespace("ns1"))
	require.NoError(t, err)
	require.Equal(t, 3, len(list1))

	// List ns2
	list2, err := sut.SecureValueMetadataStorage.List(ctx, xkube.Namespace("ns2"))
	require.NoError(t, err)
	require.Equal(t, 1, len(list2))
	require.Equal(t, "sv-other", list2[0].Name)
}
