SELECT
  team_member.org_id,
  team_member.team_id,
  team_member.user_id,
  team_member.uid,
  user.email,
  user.name,
  user.login,
  user.uid AS user_uid,
  team_member.external,
  team_member.permission,
  user_auth.auth_module,
  team.uid AS team_uid
FROM {{ .Ident .TeamMemberTable }} AS team_member
INNER JOIN {{ .Ident .UserTable }} AS user ON team_member.user_id = user.id
INNER JOIN {{ .Ident .TeamTable }} AS team ON team.id = team_member.team_id
LEFT JOIN {{ .Ident .UserAuthTable }} AS user_auth ON user_auth.id = (
  SELECT id
  FROM {{ .Ident .UserAuthTable }} AS user_auth
  WHERE user_auth.user_id = team_member.user_id
  ORDER BY user_auth.created DESC
  LIMIT 1
)
WHERE user.is_service_account = {{ .Arg .IsServiceAccount }}
{{ if .AccessUserIDs -}}
  AND user.id IN ({{ .ArgList .AccessUserIDs }})
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
ORDER BY user.login ASC, user.email ASC
