package secret

import (
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/utils/ptr"

	"github.com/grafana/grafana-app-sdk/resource"
	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/testutils"
	"github.com/grafana/grafana/pkg/registry/apis/secret/validator"
)

func TestIntegration_SecureValueClient_CRUD(t *testing.T) {
	setup := testutils.Setup(t)

	validator := validator.ProvideSecureValueValidator()

	client := ProvideSecureValueClientProvider(
		setup.SecureValueService,
		validator,
		setup.AccessClient,
	)

	ns := "stacks-1234"
	ctx := testutils.CreateUserAuthContext(t.Context(), ns, map[string][]string{
		"securevalues:create": {"securevalues:uid:*"},
		"securevalues:read":   {"securevalues:uid:*"},
		"securevalues:write":  {"securevalues:uid:*"},
		"securevalues:delete": {"securevalues:uid:*"},
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

	// Create
	createdSv, err := nsClient.Create(ctx, sv, resource.CreateOptions{})
	require.NoError(t, err)

	require.NotEmpty(t, createdSv.UID)
	require.Nil(t, createdSv.Spec.Value)
	require.Equal(t, sv.Name, createdSv.Name)
	require.Equal(t, sv.Namespace, createdSv.Namespace)

	// Read
	readSv, err := nsClient.Get(ctx, sv.Name)
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

	_, err = nsClient.Update(ctx, updatedSv, resource.UpdateOptions{})
	require.NoError(t, err)

	readSv, err = nsClient.Get(ctx, sv.Name)
	require.NoError(t, err)

	require.Equal(t, updatedSv.Spec.Description, readSv.Spec.Description)
	require.Equal(t, updatedSv.Name, readSv.Name)
	require.Equal(t, updatedSv.Namespace, readSv.Namespace)

	// List
	listSv, err := nsClient.List(ctx, resource.ListOptions{})
	require.NoError(t, err)
	require.Len(t, listSv.Items, 1)
	require.Equal(t, createdSv.Name, listSv.Items[0].GetName())
	require.Equal(t, createdSv.Namespace, listSv.Items[0].GetNamespace())

	// Delete
	err = nsClient.Delete(ctx, sv.Name, resource.DeleteOptions{})
	require.NoError(t, err)

	readSv, err = nsClient.Get(ctx, sv.Name)
	require.ErrorIs(t, err, contracts.ErrSecureValueNotFound)
	require.Nil(t, readSv)
}

func Test_SecureValueClient_CRUD_NoPermissions(t *testing.T) {
	setup := testutils.Setup(t)

	validator := validator.ProvideSecureValueValidator()

	client := ProvideSecureValueClientProvider(
		setup.SecureValueService,
		validator,
		setup.AccessClient,
	)

	ns := "stacks-1234"
	ctx := testutils.CreateUserAuthContext(t.Context(), ns, nil)

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

	// Create
	created, err := nsClient.Create(ctx, sv, resource.CreateOptions{})
	var apiErr *apierrors.StatusError
	require.ErrorAs(t, err, &apiErr)
	require.Equal(t, apiErr.ErrStatus.Reason, metav1.StatusReasonForbidden)
	require.Nil(t, created)

	// Read
	read, err := nsClient.Get(ctx, sv.Name)
	require.ErrorAs(t, err, &apiErr)
	require.Equal(t, apiErr.ErrStatus.Reason, metav1.StatusReasonForbidden)
	require.Nil(t, created)

	// Update
	updated, err := nsClient.Update(ctx, sv, resource.UpdateOptions{})
	require.ErrorAs(t, err, &apiErr)
	require.Equal(t, apiErr.ErrStatus.Reason, metav1.StatusReasonForbidden)
	require.Nil(t, updated)

	// List
	list, err := nsClient.List(ctx, resource.ListOptions{})
	require.ErrorAs(t, err, &apiErr)
	require.Equal(t, apiErr.ErrStatus.Reason, metav1.StatusReasonForbidden)
	require.Nil(t, list)

	// Delete
	err = nsClient.Delete(ctx, sv.Name, resource.DeleteOptions{})
	require.ErrorAs(t, err, &apiErr)
	require.Equal(t, apiErr.ErrStatus.Reason, metav1.StatusReasonForbidden)
	require.Nil(t, read)
}
