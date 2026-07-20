SELECT
  id,
  user_id,
  user_uid,
  auth_module,
  auth_id,
  created,
  o_auth_access_token,
  o_auth_refresh_token,
  o_auth_id_token,
  o_auth_token_type,
  o_auth_expiry,
  external_uid
FROM {{ .Ident .UserAuthTable }}
WHERE 1 = 1
{{ if .UserID }}
  AND user_id = {{ .Arg .UserID }}
{{ end }}
{{ if .AuthModule }}
  AND auth_module = {{ .Arg .AuthModule }}
{{ end }}
{{ if .AuthID }}
  AND auth_id = {{ .Arg .AuthID }}
{{ end }}
ORDER BY created DESC
LIMIT 1
