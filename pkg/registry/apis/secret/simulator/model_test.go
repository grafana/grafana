package simulator

import (
	"context"
	"fmt"
	"testing"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
)

// Model is a simplified version of the system.
// It represents some of the behaviors allowed.
type Model struct {
	secrets map[Namespace]map[SecureValueName]bool
}

func NewModel() *Model {
	return &Model{
		secrets: make(map[Namespace]map[SecureValueName]bool),
	}
}

func (model *Model) Create(
	_ context.Context,
	obj runtime.Object,
	_ rest.ValidateObjectFunc,
	_ *metav1.CreateOptions,
) (runtime.Object, error) {
	sv, ok := obj.(*secretv0alpha1.SecureValue)
	if !ok {
		return nil, fmt.Errorf("expected SecureValue for create")
	}

	if ns, ok := model.secrets[sv.Namespace]; ok {
		if _, ok := ns[sv.Name]; ok {
			return nil, contracts.ErrSecureValueAlreadyExists
		}
	}

	if _, ok := model.secrets[sv.Namespace]; !ok {
		model.secrets[sv.Namespace] = make(map[SecureValueName]bool)
	}

	model.secrets[sv.Namespace][sv.Name] = true

	return nil, nil
}

func (model *Model) Delete(namespace, name string) (bool, error) {
	if secureValues, ok := model.secrets[namespace]; ok {
		delete(secureValues, name)
		return true, nil
	}
	return true, nil
}

func TestCreate(t *testing.T) {
	t.Run("secret names are unique per namespace", func(t *testing.T) {
		t.Parallel()

		model := NewModel()

		ctx := context.Background()
		sv := &secretv0alpha1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{
				Name: "sv-1",
			},
			Spec: secretv0alpha1.SecureValueSpec{
				Value: secretv0alpha1.NewExposedSecureValue("value1"),
			},
			Status: secretv0alpha1.SecureValueStatus{
				Phase: secretv0alpha1.SecureValuePhasePending,
			},
		}
		validateObjectFunc := func(context.Context, runtime.Object) error {
			return nil
		}
		createOptions := &metav1.CreateOptions{}

		// Create the secure value metadata
		_, err := model.Create(ctx, sv, validateObjectFunc, createOptions)
		require.NoError(t, err)

		// Try to create the secure value metadata with the same namespace and name combination
		_, err = model.Create(ctx, sv, validateObjectFunc, createOptions)
		require.ErrorIs(t, err, contracts.ErrSecureValueAlreadyExists)
	})
}
