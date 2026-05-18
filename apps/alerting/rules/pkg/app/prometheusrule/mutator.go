package prometheusrule

import (
	"context"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"

	v1 "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/config"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func NewMutator(_ config.RuntimeConfig) *simple.Mutator {
	return &simple.Mutator{
		MutateFunc: func(ctx context.Context, req *app.AdmissionRequest) (*app.MutatingResponse, error) {
			pr, ok := req.Object.(*v1.PrometheusRule)
			if !ok || pr == nil {
				return nil, nil
			}

			accessor, err := utils.MetaAccessor(pr)
			if err != nil {
				return nil, err
			}
			if folderUID := accessor.GetFolder(); folderUID != "" {
				if pr.Labels == nil {
					pr.Labels = make(map[string]string)
				}
				pr.Labels[v1.FolderLabelKey] = folderUID
			}

			return &app.MutatingResponse{UpdatedObject: pr}, nil
		},
	}
}
