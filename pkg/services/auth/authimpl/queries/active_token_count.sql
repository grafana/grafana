SELECT COUNT(*)
FROM {{ .Ident .TokenTable }}
WHERE created_at > {{ .Arg .CreatedAfter }}
  AND rotated_at > {{ .Arg .RotatedAfter }}
  AND revoked_at = 0
{{ if .FilterByUser }}
  AND user_id = {{ .Arg .UserID }}
{{ end }}
