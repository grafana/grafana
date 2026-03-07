package dashboardcheck

import (
	"bytes"
	"context"
	"fmt"
	"sort"
	"strings"
	"sync"

	"github.com/grafana/grafana-app-sdk/logging"
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/pkg/services/dashboards"
	kindDashboard "github.com/grafana/grafana/pkg/services/store/kind/dashboard"
)

const MissingDatasourceStepID = "missing-datasource"

// passThroughLookup implements kindDashboard.DatasourceLookup by returning refs as-is.
type passThroughLookup struct{}

func (p *passThroughLookup) ByRef(ref *kindDashboard.DataSourceRef) *kindDashboard.DataSourceRef {
	if ref == nil {
		return &kindDashboard.DataSourceRef{}
	}
	return ref
}

func (p *passThroughLookup) ByType(dsType string) []kindDashboard.DataSourceRef {
	return []kindDashboard.DataSourceRef{{Type: dsType, UID: "*"}}
}

type missingDatasourceStep struct {
	datasourceUIDs *map[string]bool
	datasourceMu   *sync.RWMutex
}

func (s *missingDatasourceStep) ID() string {
	return MissingDatasourceStepID
}

func (s *missingDatasourceStep) Title() string {
	return "Missing datasource"
}

func (s *missingDatasourceStep) Description() string {
	return "Checks if the dashboard references datasources that no longer exist."
}

func (s *missingDatasourceStep) Resolution() string {
	return "Edit the dashboard and update or remove panels that reference missing datasources, or recreate the datasource."
}

func (s *missingDatasourceStep) Run(ctx context.Context, log logging.Logger, obj *advisor.CheckSpec, i any) ([]advisor.CheckReportFailure, error) {
	dash, ok := i.(*dashboards.Dashboard)
	if !ok {
		return nil, fmt.Errorf("invalid item type %T", i)
	}
	if dash.Data == nil {
		return nil, nil
	}
	data, err := dash.Data.MarshalJSON()
	if err != nil {
		return nil, err
	}
	info, err := kindDashboard.ReadDashboard(bytes.NewReader(data), &passThroughLookup{})
	if err != nil {
		return nil, err
	}

	s.datasourceMu.RLock()
	knownUIDs := *s.datasourceUIDs
	s.datasourceMu.RUnlock()

	// Collect all missing datasource UIDs for this dashboard (deduplicated)
	seenUIDs := make(map[string]bool)
	var missingUIDs []string

	collectMissing := func(uid string) {
		if uid == "" || seenUIDs[uid] || isSpecialDatasourceUID(uid) || knownUIDs[uid] {
			return
		}
		seenUIDs[uid] = true
		log.Debug("Found reference to missing datasource", "uid", uid, "dashboard", dash.Title, "dashboardUID", dash.UID)
		missingUIDs = append(missingUIDs, uid)
	}

	// Dashboard-level datasource refs
	for _, ref := range info.Datasource {
		collectMissing(ref.UID)
	}

	// Panel-level datasource refs (including collapsed rows)
	for p := range info.PanelIterator() {
		for _, ref := range p.Datasource {
			collectMissing(ref.UID)
		}
	}

	if len(missingUIDs) == 0 {
		return nil, nil
	}

	// One report per dashboard; MoreInfo lists all missing datasource UIDs
	sort.Strings(missingUIDs)
	moreInfo := "Missing datasource UIDs: " + strings.Join(missingUIDs, ", ")
	slug := dash.Slug
	if slug == "" {
		slug = dash.UID
	}
	editURL := fmt.Sprintf("/d/%s/%s", dash.UID, slug)

	return []advisor.CheckReportFailure{
		checks.NewCheckReportFailureWithMoreInfo(
			advisor.CheckReportFailureSeverityHigh,
			s.ID(),
			fmt.Sprintf("%s - missing datasource(s): %s", dash.Title, strings.Join(missingUIDs, ", ")),
			dash.UID,
			[]advisor.CheckErrorLink{
				{Message: "Edit dashboard", Url: editURL},
			},
			moreInfo,
		),
	}, nil
}

// isSpecialDatasourceUID returns true for built-in or template UIDs that should not be validated.
func isSpecialDatasourceUID(uid string) bool {
	if uid == "" {
		return true
	}
	if uid == "grafana" || uid == "default" {
		return true
	}
	if strings.HasPrefix(uid, "--") {
		return true
	}
	return false
}
