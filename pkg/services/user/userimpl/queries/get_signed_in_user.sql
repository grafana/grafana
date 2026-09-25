SELECT
  u.id AS user_id,
  u.uid AS user_uid,
  u.is_admin AS is_grafana_admin,
  u.email AS email,
  u.email_verified AS email_verified,
  u.login AS login,
  u.name AS name,
  u.is_disabled AS is_disabled,
  u.help_flags1 AS help_flags1,
  u.last_seen_at AS last_seen_at,
  org.name AS org_name,
  org_user.role AS org_role,
  org.id AS org_id,
  u.is_service_account AS is_service_account
FROM {{ .Ident .UserTable }} AS u
LEFT OUTER JOIN {{ .Ident .OrgUserTable }} AS org_user
  ON org_user.org_id = {{ if gt .OrgID 0 }}{{ .Arg .OrgID }}{{ else }}u.org_id{{ end }}
  AND org_user.user_id = u.id
LEFT OUTER JOIN {{ .Ident .OrgTable }} AS org
  ON org.id = org_user.org_id
{{ if gt .UserID 0 -}}
WHERE u.id = {{ .Arg .UserID }}
{{ else if .Login -}}
WHERE LOWER(u.login) = LOWER({{ .Arg .Login }})
{{ else if .Email -}}
WHERE LOWER(u.email) = LOWER({{ .Arg .Email }})
{{ end -}}
