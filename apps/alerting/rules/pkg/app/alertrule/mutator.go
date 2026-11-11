package alertrule

import (
	"context"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"
	v1 "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v1beta1"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/config"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/convert"
)

func NewMutator(cfg config.RuntimeConfig) *simple.Mutator {
	return &simple.Mutator{
		MutateFunc: func(ctx context.Context, req *app.AdmissionRequest) (*app.MutatingResponse, error) {
			r, err := convert.Hub[*v1.AlertRule](req.Object)
			if err != nil {
				return nil, err
			}
			if r == nil {
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

			// For backwards compatibility with the old notification settings object we need to set the default to SimplifiedRouting here
			// we need to do this here because cog doesn't thread the default enum value for the discriminator all the way through
			if ns := r.Spec.NotificationSettings; ns != nil && ns.SimplifiedRouting != nil && ns.SimplifiedRouting.Type == "" {
				ns.SimplifiedRouting.Type = v1.AlertRuleNotificationSettingsTypeSimplifiedRouting
			}

			out, err := convert.Like(r, req.Object)
			if err != nil {
				return nil, err
			}
			return &app.MutatingResponse{UpdatedObject: out}, nil
		},
	}
}
