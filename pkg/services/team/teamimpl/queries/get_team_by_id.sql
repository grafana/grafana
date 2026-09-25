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
    FROM {{ .Ident .TeamMemberTable }} AS team_member
    {{ if .FilteredUsers -}}
    INNER JOIN {{ .Ident .UserTable }} AS member_user ON team_member.user_id = member_user.id
    {{ end -}}
    WHERE team_member.team_id = team.id
    {{ if .FilteredUsers -}}
      AND member_user.login NOT IN ({{ .ArgList .FilteredUsers }})
    {{ end -}}
  ) AS member_count
FROM {{ .Ident .TeamTable }} AS team
WHERE team.org_id = {{ .Arg .OrgID }}
{{ if .ID -}}
  AND team.id = {{ .Arg .ID }}
{{ else -}}
  AND team.uid = {{ .Arg .UID }}
{{ end -}}
