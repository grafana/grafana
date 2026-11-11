package teamimpl

import (
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/legacysql/legacywatch"
)

// QueueTeamMembershipChanged announces, once sess commits, a change to a team's
// membership as a modified Team, since its members are part of its spec.
//
// It costs one lookup of the team's UID. To keep that the only extra query, it
// does not check whether the write changed anything: setting a member to the
// permission they already hold is announced too. Consumers re-fetch, so a
// spurious MODIFIED is harmless.
func QueueTeamMembershipChanged(dbHelper *legacysql.LegacyDatabaseHelper, sess *db.Session, orgID, teamID int64) error {
	var teamUID string
	if _, err := sess.Table(dbHelper.Table("team")).Where("org_id = ? AND id = ?", orgID, teamID).Cols("uid").Get(&teamUID); err != nil {
		return err
	}
	if teamUID == "" {
		return nil
	}
	sess.PublishAfterCommit(&legacywatch.LegacyWatchNotification{
		Type:     legacywatch.Modified,
		Resource: iamv0alpha1.TeamResourceInfo.GroupResource(),
		OrgID:    orgID,
		Name:     teamUID,
	})
	return nil
}
