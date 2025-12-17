package recordingrule

import (
	"context"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"
	v1 "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/config"
)

func NewMutator(cfg config.RuntimeConfig) *simple.Mutator {
	return &simple.Mutator{
		MutateFunc: func(ctx context.Context, req *app.AdmissionRequest) (*app.MutatingResponse, error) {
			r, ok := req.Object.(*v1.RecordingRule)
			if !ok || r == nil {
				return nil, nil
			}

			folderUID := ""
			if r.Annotations != nil {
				folderUID = r.Annotations[v1.FolderAnnotationKey]
			}

			if folderUID != "" {
				if r.Labels == nil {
					r.Labels = make(map[string]string)
				}
				r.Labels[v1.FolderLabelKey] = folderUID
			}
			if err := r.Spec.ClampDurations(); err != nil {
				return nil, err
			}
			return &app.MutatingResponse{UpdatedObject: r}, nil
		},
	}
}
