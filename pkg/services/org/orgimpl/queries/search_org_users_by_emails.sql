SELECT
  org_user.org_id,
  org_user.user_id,
  u.email,
  u.uid,
  u.name,
  u.login,
  org_user.role,
  u.last_seen_at,
  u.created,
  u.updated,
  u.is_disabled,
  u.is_provisioned
FROM {{ .Ident .OrgUserTable }} AS org_user
INNER JOIN {{ .Ident .UserTable }} AS u ON org_user.user_id = u.id
WHERE org_user.org_id = {{ .Arg .OrgID }}
  AND u.email IN ({{ .ArgList .Emails }})
  AND u.is_service_account = {{ .Arg .IsServiceAccount }}
{{ if .HiddenUserLogins -}}
  AND u.login NOT IN ({{ .ArgList .HiddenUserLogins }})
{{ end -}}
ORDER BY u.login ASC, u.email ASC
