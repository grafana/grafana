package alertrule

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
			// Mutate folder label to match folder UID from annotation
			r, ok := req.Object.(*v1.AlertRule)
			if !ok || r == nil {
				// Nothing to do or wrong type; no mutation
				return nil, nil
			}

			// Read folder UID from annotation
			folderUID := ""
			if r.Annotations != nil {
				folderUID = r.Annotations[v1.FolderAnnotationKey]
			}

			// Ensure labels map exists and set the folder label if folderUID is present
			if folderUID != "" {
				if r.Labels == nil {
					r.Labels = make(map[string]string)
				}
				// Maintain folder metadata label for downstream systems (alertmanager grouping etc.)
				r.Labels[v1.FolderLabelKey] = folderUID
			}

			// clamp all duration fields
			if err := r.Spec.ClampDurations(); err != nil {
				return nil, err
			}

			return &app.MutatingResponse{UpdatedObject: r}, nil
		},
	}
}
