{{ if eq .DialectName "sqlite" }}
UPDATE {{ .Ident .UserAuthTable }}
SET user_uid = (
  SELECT uid
  FROM {{ .Ident .UserTable }}
  WHERE id = user_id
)
WHERE user_id IN (SELECT id FROM {{ .Ident .UserTable }})
  AND user_uid IS NULL
{{ else if eq .DialectName "postgres" }}
UPDATE {{ .Ident .UserAuthTable }} AS ua
SET user_uid = u.uid
FROM {{ .Ident .UserTable }} AS u
WHERE u.id = ua.user_id
  AND ua.user_uid IS NULL
{{ else if eq .DialectName "mysql" }}
UPDATE {{ .Ident .UserAuthTable }} AS ua
INNER JOIN {{ .Ident .UserTable }} AS u ON ua.user_id = u.id
SET ua.user_uid = u.uid
WHERE ua.user_uid IS NULL
{{ end }}
