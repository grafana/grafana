package metadata_test

import (
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

func TestModel(t *testing.T) {
	t.Parallel()

	sv := &secretv1beta1.SecureValue{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "sv1",
			Namespace: "ns1",
		},
		Spec: secretv1beta1.SecureValueSpec{
			Description: "desc1",
			Value:       ptr.To(secretv1beta1.NewExposedSecureValue("v1")),
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
		sv4.Spec.Value = ptr.To(secretv1beta1.NewExposedSecureValue("sv4"))
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
				Ref:         ptr.To("ref1"),
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

func TestStateMachine(t *testing.T) {
	t.Parallel()

	tt := t

	rapid.Check(t, func(t *rapid.T) {
		sut := testutils.Setup(tt)
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
		})
	})
}

func TestSecureValueServiceExampleBased(t *testing.T) {
	t.Parallel()

	t.Run("shouldn't be able to decrypt using deleted secure value", func(t *testing.T) {
		t.Parallel()

		sut := testutils.Setup(t)

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
