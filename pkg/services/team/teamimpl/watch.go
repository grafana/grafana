package teamimpl

import (
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/legacysql/legacywatch"
)

// TeamMemberRef names a membership the way the IAM API does: the team's UID,
// and the team_member UID, which is the name of its TeamBinding. UID is empty
// when the user is not a member.
type TeamMemberRef struct {
	TeamUID string
	UID     string
}

// GetTeamMemberRef reads the names of a membership within sess, so a caller can
// take them before and after changing it and announce the difference.
func GetTeamMemberRef(dbHelper *legacysql.LegacyDatabaseHelper, sess *db.Session, orgID, teamID, userID int64) (TeamMemberRef, error) {
	var ref TeamMemberRef
	if _, err := sess.Table(dbHelper.Table("team")).Where("org_id = ? AND id = ?", orgID, teamID).Cols("uid").Get(&ref.TeamUID); err != nil {
		return ref, err
	}
	if _, err := sess.Table(dbHelper.Table("team_member")).Where("org_id = ? AND team_id = ? AND user_id = ?", orgID, teamID, userID).Cols("uid").Get(&ref.UID); err != nil {
		return ref, err
	}
	return ref, nil
}

// QueueTeamMemberNotifications announces, once sess commits, a membership that
// changed from before to after: the TeamBinding is added, modified or deleted,
// and the Team is modified, since its members are part of its spec.
func QueueTeamMemberNotifications(sess *db.Session, orgID int64, before, after TeamMemberRef) {
	typ, binding := legacywatch.Modified, after.UID
	switch {
	case before.UID == "" && after.UID == "":
		return
	case before.UID == "":
		typ = legacywatch.Added
	case after.UID == "":
		typ, binding = legacywatch.Deleted, before.UID
	}
	sess.PublishAfterCommit(&legacywatch.LegacyWatchNotification{
		Type:     typ,
		Resource: iamv0alpha1.TeamBindingResourceInfo.GroupResource(),
		OrgID:    orgID,
		Name:     binding,
	})
	sess.PublishAfterCommit(&legacywatch.LegacyWatchNotification{
		Type:     legacywatch.Modified,
		Resource: iamv0alpha1.TeamResourceInfo.GroupResource(),
		OrgID:    orgID,
		Name:     before.TeamUID,
	})
}
