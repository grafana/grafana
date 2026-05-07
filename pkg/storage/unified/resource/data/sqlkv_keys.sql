SELECT {{ .Ident "key_path" }}
FROM {{ .TableName }}
WHERE {{ .Ident "key_path" }} >= {{ .Arg .StartKey }}
  AND {{ .Ident "key_path" }} < {{ .Arg .EndKey }}
ORDER BY {{ .Ident "key_path" }} {{ if .SortAscending }}ASC{{ else }}DESC{{ end }}
{{ if .Options.Limit }}
LIMIT {{ .Options.Limit }}
{{ end }}
;
