package secret

import (
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/utils/ptr"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/testutils"
	"github.com/grafana/grafana/pkg/registry/apis/secret/validator"
)

func TestIntegration_SecureValueClient_CRUD(t *testing.T) {
	setup := testutils.Setup(t)

	validator := validator.ProvideSecureValueValidator()

	client := ProvideSecureValueClient(
		setup.SecureValueService,
		validator,
	)

	ns := "stacks-1234"
	ctx := testutils.CreateUserAuthContext(t.Context(), ns, map[string][]string{
		"securevalues:read": {"securevalues:uid:*"},
	})

	nsClient, err := client.Client(ctx, ns)
	require.NoError(t, err)
	require.NotNil(t, nsClient)

	sv := &secretv1beta1.SecureValue{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-sv",
			Namespace: ns,
		},
		Spec: secretv1beta1.SecureValueSpec{
			Description: "test-description",
			Value:       ptr.To(secretv1beta1.NewExposedSecureValue("test-value")),
		},
	}

	unstructured, err := toUnstructured(sv)
	require.NoError(t, err)

	// Create
	created, err := nsClient.Create(ctx, unstructured, metav1.CreateOptions{})
	require.NoError(t, err)

	createdSv, err := fromUnstructured(created)
	require.NoError(t, err)

	require.NotEmpty(t, createdSv.UID)
	require.Nil(t, createdSv.Spec.Value)
	require.Equal(t, sv.Name, createdSv.Name)
	require.Equal(t, sv.Namespace, createdSv.Namespace)

	// Read
	read, err := nsClient.Get(ctx, createdSv.Name, metav1.GetOptions{})
	require.NoError(t, err)

	readSv, err := fromUnstructured(read)
	require.NoError(t, err)
	require.EqualValues(t, createdSv, readSv)

	// Update
	updatedSv := &secretv1beta1.SecureValue{
		ObjectMeta: metav1.ObjectMeta{
			Name:      createdSv.Name,
			Namespace: createdSv.Namespace,
		},
		Spec: secretv1beta1.SecureValueSpec{
			Description: "test-description-updated",
			Value:       ptr.To(secretv1beta1.NewExposedSecureValue("test-value-updated")),
		},
	}

	unstructured, err = toUnstructured(updatedSv)
	require.NoError(t, err)

	_, err = nsClient.Update(ctx, unstructured, metav1.UpdateOptions{})
	require.NoError(t, err)

	read, err = nsClient.Get(ctx, createdSv.Name, metav1.GetOptions{})
	require.NoError(t, err)
	readSv, err = fromUnstructured(read)
	require.NoError(t, err)
	require.Equal(t, updatedSv.Spec.Description, readSv.Spec.Description)
	require.Equal(t, updatedSv.Name, readSv.Name)
	require.Equal(t, updatedSv.Namespace, readSv.Namespace)

	// List
	list, err := nsClient.List(ctx, metav1.ListOptions{})
	require.NoError(t, err)
	require.Len(t, list.Items, 1)
	require.Equal(t, createdSv.Name, list.Items[0].GetName())
	require.Equal(t, createdSv.Namespace, list.Items[0].GetNamespace())

	// Delete
	err = nsClient.Delete(ctx, createdSv.Name, metav1.DeleteOptions{})
	require.NoError(t, err)

	read, err = nsClient.Get(ctx, createdSv.Name, metav1.GetOptions{})
	require.ErrorIs(t, err, contracts.ErrSecureValueNotFound)
	require.Nil(t, read)
}
