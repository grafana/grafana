package datasourcecheck

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/logging"
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apps/advisor/checks"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/util"
)

type uidValidationStep struct{}

func (s *uidValidationStep) ID() string {
	return UIDValidationStepID
}

func (s *uidValidationStep) Title() string {
	return "UID validation"
}

func (s *uidValidationStep) Description() string {
	return "Checks if the UID of a data source is valid."
}

func (s *uidValidationStep) Resolution() string {
	return "Check the <a href='https://grafana.com/docs/grafana/latest/upgrade-guide/upgrade-v11.2/#grafana-data-source-uid-format-enforcement'" +
		"target=_blank>documentation</a> for more information or delete the data source and create a new one."
}

func (s *uidValidationStep) Run(ctx context.Context, log logging.Logger, obj *advisor.CheckSpec, i any) ([]advisor.CheckReportFailure, error) {
	ds, ok := i.(*datasources.DataSource)
	if !ok {
		return nil, fmt.Errorf("invalid item type %T", i)
	}
	// Data source UID validation
	err := util.ValidateUID(ds.UID)
	if err != nil {
		return []advisor.CheckReportFailure{checks.NewCheckReportFailure(
			advisor.CheckReportFailureSeverityLow,
			s.ID(),
			fmt.Sprintf("%s (%s)", ds.Name, ds.UID),
			ds.UID,
			[]advisor.CheckErrorLink{},
		)}, nil
	}
	return nil, nil
}
