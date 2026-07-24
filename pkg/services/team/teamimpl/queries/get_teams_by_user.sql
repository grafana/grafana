SELECT
  team.id as id,
  team.uid,
  team.org_id,
  team.name as name,
  team.email as email,
  team.external_uid as external_uid,
  team.is_provisioned as is_provisioned,
  (SELECT COUNT(*) FROM {{ .Ident .TeamMemberTable }} WHERE team_member.team_id = team.id) AS member_count
FROM {{ .Ident .TeamTable }} as team
INNER JOIN {{ .Ident .TeamMemberTable }} on team.id = team_member.team_id
WHERE team.org_id = ? and team_member.user_id = ?
 and{{ .ACFilterWhere }}
