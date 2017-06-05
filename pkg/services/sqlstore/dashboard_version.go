package sqlstore

import (
	"encoding/json"
	"errors"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/formatter"
	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"

	diff "github.com/yudai/gojsondiff"
	deltaFormatter "github.com/yudai/gojsondiff/formatter"
)

var (
	// ErrUnsupportedDiffType occurs when an invalid diff type is used.
	ErrUnsupportedDiffType = errors.New("sqlstore: unsupported diff type")

	// ErrNilDiff occurs when two compared interfaces are identical.
	ErrNilDiff = errors.New("sqlstore: diff is nil")
)

func init() {
	bus.AddHandler("sql", CompareDashboardVersionsCommand)
	bus.AddHandler("sql", GetDashboardVersion)
	bus.AddHandler("sql", GetDashboardVersions)
}

// CompareDashboardVersionsCommand computes the JSON diff of two versions,
// assigning the delta of the diff to the `Delta` field.
func CompareDashboardVersionsCommand(cmd *m.CompareDashboardVersionsCommand) error {
	original, err := getDashboardVersion(cmd.DashboardId, cmd.Original)
	if err != nil {
		return err
	}

	newDashboard, err := getDashboardVersion(cmd.DashboardId, cmd.New)
	if err != nil {
		return err
	}

	left, jsonDiff, err := getDiff(original, newDashboard)
	if err != nil {
		return err
	}

	switch cmd.DiffType {
	case m.DiffDelta:

		deltaOutput, err := deltaFormatter.NewDeltaFormatter().Format(jsonDiff)
		if err != nil {
			return err
		}
		cmd.Delta = []byte(deltaOutput)

	case m.DiffJSON:
		jsonOutput, err := formatter.NewJSONFormatter(left).Format(jsonDiff)
		if err != nil {
			return err
		}
		cmd.Delta = []byte(jsonOutput)

	case m.DiffBasic:
		basicOutput, err := formatter.NewBasicFormatter(left).Format(jsonDiff)
		if err != nil {
			return err
		}
		cmd.Delta = basicOutput

	default:
		return ErrUnsupportedDiffType
	}

	return nil
}

// GetDashboardVersion gets the dashboard version for the given dashboard ID
// and version number.
func GetDashboardVersion(query *m.GetDashboardVersionQuery) error {
	result, err := getDashboardVersion(query.DashboardId, query.Version)
	if err != nil {
		return err
	}

	query.Result = result
	return nil
}

// GetDashboardVersions gets all dashboard versions for the given dashboard ID.
func GetDashboardVersions(query *m.GetDashboardVersionsQuery) error {
	err := x.Table("dashboard_version").
		Select(`dashboard_version.id,
				dashboard_version.dashboard_id,
				dashboard_version.parent_version,
				dashboard_version.restored_from,
				dashboard_version.version,
				dashboard_version.created,
				dashboard_version.created_by as created_by_id,
				dashboard_version.message,
				dashboard_version.data,
				"user".login as created_by`).
		Join("LEFT", "user", `dashboard_version.created_by = "user".id`).
		Join("LEFT", "dashboard", `dashboard.id = "dashboard_version".dashboard_id`).
		Where("dashboard_version.dashboard_id=? AND dashboard.org_id=?", query.DashboardId, query.OrgId).
		OrderBy("dashboard_version.version DESC").
		Limit(query.Limit, query.Start).
		Find(&query.Result)
	if err != nil {
		return err
	}

	if len(query.Result) < 1 {
		return m.ErrNoVersionsForDashboardId
	}
	return nil
}

// getDashboardVersion is a helper function that gets the dashboard version for
// the given dashboard ID and version ID.
func getDashboardVersion(dashboardId int64, version int) (*m.DashboardVersion, error) {
	dashboardVersion := m.DashboardVersion{}
	has, err := x.Where("dashboard_id=? AND version=?", dashboardId, version).Get(&dashboardVersion)
	if err != nil {
		return nil, err
	}
	if !has {
		return nil, m.ErrDashboardVersionNotFound
	}

	dashboardVersion.Data.Set("id", dashboardVersion.DashboardId)
	return &dashboardVersion, nil
}

// getDashboard gets a dashboard by ID. Used for retrieving the dashboard
// associated with dashboard versions.
func getDashboard(dashboardId int64) (*m.Dashboard, error) {
	dashboard := m.Dashboard{Id: dashboardId}
	has, err := x.Get(&dashboard)
	if err != nil {
		return nil, err
	}
	if has == false {
		return nil, m.ErrDashboardNotFound
	}
	return &dashboard, nil
}

// getDiff computes the diff of two dashboard versions.
func getDiff(originalDash, newDash *m.DashboardVersion) (interface{}, diff.Diff, error) {
	leftBytes, err := simplejson.NewFromAny(originalDash).Encode()
	if err != nil {
		return nil, nil, err
	}

	rightBytes, err := simplejson.NewFromAny(newDash).Encode()
	if err != nil {
		return nil, nil, err
	}

	jsonDiff, err := diff.New().Compare(leftBytes, rightBytes)
	if err != nil {
		return nil, nil, err
	}

	if !jsonDiff.Modified() {
		return nil, nil, ErrNilDiff
	}

	left := make(map[string]interface{})
	err = json.Unmarshal(leftBytes, &left)
	return left, jsonDiff, nil
}
