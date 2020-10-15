package sqlstore

import (
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/securedata"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

func init() {
	bus.AddHandler("sql", CreateDashboardSnapshot)
	bus.AddHandler("sql", GetDashboardSnapshot)
	bus.AddHandler("sql", DeleteDashboardSnapshot)
	bus.AddHandler("sql", SearchDashboardSnapshots)
	bus.AddHandler("sql", DeleteExpiredSnapshots)
}

// DeleteExpiredSnapshots removes snapshots with old expiry dates.
// SnapShotRemoveExpired is deprecated and should be removed in the future.
// Snapshot expiry is decided by the user when they share the snapshot.
func DeleteExpiredSnapshots(cmd *models.DeleteExpiredSnapshotsCommand) error {
	return inTransaction(func(sess *DBSession) error {
		if !setting.SnapShotRemoveExpired {
			sqlog.Warn("[Deprecated] The snapshot_remove_expired setting is outdated. Please remove from your config.")
			return nil
		}

		deleteExpiredSql := "DELETE FROM dashboard_snapshot WHERE expires < ?"
		expiredResponse, err := sess.Exec(deleteExpiredSql, time.Now())
		if err != nil {
			return err
		}
		cmd.DeletedRows, _ = expiredResponse.RowsAffected()

		return nil
	})
}

func CreateDashboardSnapshot(cmd *models.CreateDashboardSnapshotCommand) error {
	return inTransaction(func(sess *DBSession) error {
		// never
		var expires = time.Now().Add(time.Hour * 24 * 365 * 50)
		if cmd.Expires > 0 {
			expires = time.Now().Add(time.Second * time.Duration(cmd.Expires))
		}

		marshalledData, err := cmd.Dashboard.Encode()
		if err != nil {
			return err
		}

		encryptedDashboard, err := securedata.Encrypt(marshalledData)
		if err != nil {
			return err
		}

		snapshot := &models.DashboardSnapshot{
			Name:               cmd.Name,
			Key:                cmd.Key,
			DeleteKey:          cmd.DeleteKey,
			OrgId:              cmd.OrgId,
			UserId:             cmd.UserId,
			External:           cmd.External,
			ExternalUrl:        cmd.ExternalUrl,
			ExternalDeleteUrl:  cmd.ExternalDeleteUrl,
			Dashboard:          simplejson.New(),
			DashboardEncrypted: encryptedDashboard,
			Expires:            expires,
			Created:            time.Now(),
			Updated:            time.Now(),
		}
		_, err = sess.Insert(snapshot)
		cmd.Result = snapshot

		return err
	})
}

func DeleteDashboardSnapshot(cmd *models.DeleteDashboardSnapshotCommand) error {
	return inTransaction(func(sess *DBSession) error {
		var rawSql = "DELETE FROM dashboard_snapshot WHERE delete_key=?"
		_, err := sess.Exec(rawSql, cmd.DeleteKey)
		return err
	})
}

func GetDashboardSnapshot(query *models.GetDashboardSnapshotQuery) error {
	snapshot := models.DashboardSnapshot{Key: query.Key, DeleteKey: query.DeleteKey}
	has, err := x.Get(&snapshot)

	if err != nil {
		return err
	} else if !has {
		return models.ErrDashboardSnapshotNotFound
	}

	query.Result = &snapshot
	return nil
}

// SearchDashboardSnapshots returns a list of all snapshots for admins
// for other roles, it returns snapshots created by the user
func SearchDashboardSnapshots(query *models.GetDashboardSnapshotsQuery) error {
	var snapshots = make(models.DashboardSnapshotsList, 0)

	sess := x.Limit(query.Limit)
	sess.Table("dashboard_snapshot")

	if query.Name != "" {
		sess.Where("name LIKE ?", query.Name)
	}

	// admins can see all snapshots, everyone else can only see their own snapshots
	switch {
	case query.SignedInUser.OrgRole == models.ROLE_ADMIN:
		sess.Where("org_id = ?", query.OrgId)
	case !query.SignedInUser.IsAnonymous:
		sess.Where("org_id = ? AND user_id = ?", query.OrgId, query.SignedInUser.UserId)
	default:
		query.Result = snapshots
		return nil
	}

	err := sess.Find(&snapshots)
	query.Result = snapshots
	return err
}
