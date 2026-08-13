SELECT
  team.id AS id,
  team.uid,
  team.org_id,
  team.name AS name,
  team.email AS email,
  team.external_uid AS external_uid,
  team.is_provisioned AS is_provisioned,
  (
    SELECT COUNT(*)
    FROM {{ .Ident .TeamMemberTable }} AS member_count_team_member
    WHERE member_count_team_member.team_id = team.id
  ) AS member_count
FROM {{ .Ident .TeamTable }} AS team
INNER JOIN {{ .Ident .TeamMemberTable }} AS team_member ON team.id = team_member.team_id
WHERE team.org_id = {{ .Arg .OrgID }}
  AND team_member.user_id = {{ .Arg .UserID }}
{{ if .AccessTeamIDs -}}
  AND team.id IN ({{ .ArgList .AccessTeamIDs }})
{{ else if not .AccessAll -}}
  AND 1 = 0
{{ end -}}
