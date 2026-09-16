package config

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/validation"
)

// Config is a per-org singleton, so the only valid name is the well-known
// singleton name.
func ValidateConfigWrite(cfg RuntimeConfig) validation.ValidateFunc[*v0alpha1.Config] {
	return func(ctx context.Context, req validation.Request[*v0alpha1.Config]) error {
		obj := req.Object
		if obj.GetName() != v0alpha1.ConfigSingletonName {
			return fmt.Errorf("kind Config is a singleton; the only valid name is %q", v0alpha1.ConfigSingletonName)
		}
		return nil
	}
}
