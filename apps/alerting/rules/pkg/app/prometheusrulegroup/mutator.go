package prometheusrulegroup

import (
	"context"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"

	v1 "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/config"
)

func NewMutator(_ config.RuntimeConfig) *simple.Mutator {
	return &simple.Mutator{
		MutateFunc: func(ctx context.Context, req *app.AdmissionRequest) (*app.MutatingResponse, error) {
			g, ok := req.Object.(*v1.PrometheusRuleGroup)
			if !ok || g == nil {
				return nil, nil
			}

			folderUID := ""
			if g.Annotations != nil {
				folderUID = g.Annotations[v1.FolderAnnotationKey]
			}
			if folderUID != "" {
				if g.Labels == nil {
					g.Labels = make(map[string]string)
				}
				g.Labels[v1.FolderLabelKey] = folderUID
			}

			return &app.MutatingResponse{UpdatedObject: g}, nil
		},
	}
}
