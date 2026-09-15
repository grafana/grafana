SELECT COUNT(*)
FROM {{ .Ident .TokenTable }}
WHERE created_at > {{ .Arg .CreatedAfter }}
  AND seen_at > {{ .Arg .SeenAfter }}
  AND revoked_at = 0
{{ if .FilterByUser }}
  AND user_id = {{ .Arg .UserID }}
{{ end }}
