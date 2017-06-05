package sqlstore

import (
	"encoding/json"
	"errors"
	"time"

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
	bus.AddHandler("sql", RestoreDashboardVersion)
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

// RestoreDashboardVersion restores the dashboard data to the given version.
func RestoreDashboardVersion(cmd *m.RestoreDashboardVersionCommand) error {
	return inTransaction(func(sess *DBSession) error {
		// check if dashboard version exists in dashboard_version table
		//
		// normally we could use the getDashboardVersion func here, but since
		// we're in a transaction, we need to run the queries using the
		// session instead of using the global `x`, so we copy those functions
		// here, replacing `x` with `sess`
		dashboardVersion := m.DashboardVersion{}
		has, err := sess.Where("dashboard_id=? AND version=?", cmd.DashboardId, cmd.Version).Get(&dashboardVersion)
		if err != nil {
			return err
		}
		if !has {
			return m.ErrDashboardVersionNotFound
		}

		dashboardVersion.Data.Set("id", dashboardVersion.DashboardId)

		dashboard := m.Dashboard{Id: cmd.DashboardId}
		// Get the dashboard version
		if has, err = sess.Get(&dashboard); err != nil {
			return err
		} else if !has {
			return m.ErrDashboardNotFound
		}

		version, err := getMaxVersion(sess, dashboard.Id)
		if err != nil {
			return err
		}

		// revert and save to a new dashboard version
		dashboard.Data = dashboardVersion.Data
		dashboard.Updated = time.Now()
		dashboard.UpdatedBy = cmd.UserId
		dashboard.Version = version
		dashboard.Data.Set("version", dashboard.Version)

		// Update dashboard
		if affectedRows, err := sess.Id(dashboard.Id).Update(dashboard); err != nil {
			return err
		} else if affectedRows == 0 {
			return m.ErrDashboardNotFound
		}

		// save that version a new version
		dashVersion := &m.DashboardVersion{
			DashboardId:   dashboard.Id,
			ParentVersion: cmd.Version,
			RestoredFrom:  cmd.Version,
			Version:       dashboard.Version,
			Created:       time.Now(),
			CreatedBy:     dashboard.UpdatedBy,
			Message:       "",
			Data:          dashboard.Data,
		}

		if affectedRows, err := sess.Insert(dashVersion); err != nil {
			return err
		} else if affectedRows == 0 {
			return m.ErrDashboardNotFound
		}

		cmd.Result = &dashboard
		return nil
	})
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

type version struct {
	Max int
}

// getMaxVersion returns the highest version number in the `dashboard_version`
// table.
//
// This is necessary because sqlite3 doesn't support autoincrement in the same
// way that Postgres or MySQL do, so we use this to get around that. Since it's
// impossible to delete a version in Grafana, this is believed to be a
// safe-enough alternative.
func getMaxVersion(sess *DBSession, dashboardId int64) (int, error) {
	v := version{}
	has, err := sess.Table("dashboard_version").
		Select("MAX(version) AS max").
		Where("dashboard_id = ?", dashboardId).
		Get(&v)
	if !has {
		return 0, m.ErrDashboardNotFound
	}
	if err != nil {
		return 0, err
	}

	v.Max++
	return v.Max, nil
}
