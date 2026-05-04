package datasource

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/util"
)

// generatedNameStorage wraps a Storage to assign a server-generated name when
// the incoming object has neither name nor generateName set. Datasource
// creation relies on server-side UID generation: the frontend sends no name
// and expects the legacy SQL store to assign one. The dualwriter requires a
// name before calling the legacy store, so this wrapper generates one upfront
// using the same short-UID format that the SQL store would use.
type generatedNameStorage struct {
	grafanarest.Storage
}

func (s *generatedNameStorage) Create(ctx context.Context, in runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	acc, err := utils.MetaAccessor(in)
	if err == nil && acc.GetName() == "" && acc.GetGenerateName() == "" {
		acc.SetName(util.GenerateShortUID())
	}
	return s.Storage.Create(ctx, in, createValidation, options)
}
