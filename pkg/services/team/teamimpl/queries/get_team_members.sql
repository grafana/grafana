SELECT
  team_member.org_id,
  team_member.team_id,
  team_member.user_id,
  team_member.uid,
  team_user.email,
  team_user.name,
  team_user.login,
  team_user.uid AS user_uid,
  COALESCE(team_member.external, FALSE) AS {{ .Ident "external" }},
  COALESCE(team_member.permission, 0) AS permission,
  user_auth.auth_module,
  team.uid AS team_uid
FROM {{ .Ident .TeamMemberTable }} AS team_member
INNER JOIN {{ .Ident .UserTable }} AS team_user ON team_member.user_id = team_user.id
INNER JOIN {{ .Ident .TeamTable }} AS team ON team.id = team_member.team_id
LEFT JOIN {{ .Ident .UserAuthTable }} AS user_auth ON user_auth.id = (
  SELECT id
  FROM {{ .Ident .UserAuthTable }} AS user_auth
  WHERE user_auth.user_id = team_member.user_id
  ORDER BY user_auth.created DESC
  LIMIT 1
)
WHERE team_user.is_service_account = {{ .Arg .IsServiceAccount }}
{{ if .AccessUserIDs -}}
  AND team_user.id IN ({{ .ArgList .AccessUserIDs }})
{{ else if not .AccessAll -}}
  AND 1 = 0
{{ end -}}
{{ if .OrgID -}}
  AND team_member.org_id = {{ .Arg .OrgID }}
{{ end -}}
{{ if .TeamID -}}
  AND team_member.team_id = {{ .Arg .TeamID }}
{{ end -}}
{{ if .TeamUID -}}
  AND team.uid = {{ .Arg .TeamUID }}
{{ end -}}
{{ if .UserID -}}
  AND team_member.user_id = {{ .Arg .UserID }}
{{ end -}}
{{ if .External -}}
  AND team_member.external = {{ .Arg .IsExternal }}
{{ end -}}
ORDER BY team_user.login ASC, team_user.email ASC
