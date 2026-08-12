package app

import (
	"context"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"
)

var _ simple.KindMutator = NewMutator()

type Mutator struct{}

func NewMutator() *Mutator {
	return &Mutator{}
}

// Mutate makes modifications to an input object from the API, and returns the changed object.
// This mutation will be done on every request, so it can be used to add or update things like labels
// or annotations. Here, we add an annotation noting the last resourceVersion this was called for.
func (m *Mutator) Mutate(ctx context.Context, req *app.AdmissionRequest) (*app.MutatingResponse, error) {
	annotations := req.Object.GetAnnotations()
	if annotations == nil {
		annotations = make(map[string]string)
	}
	annotations["example.grafana.app/mutated"] = req.Object.GetResourceVersion()
	req.Object.SetAnnotations(annotations)
	return &app.MutatingResponse{
		UpdatedObject: req.Object,
	}, nil
}
