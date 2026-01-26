SELECT r.{{ .Ident "key_path" }}, r.{{ .Ident "value" }}
FROM (
{{ range $id, $key_path := .KeyPaths }}
    {{ if eq $id 0 }}
        SELECT {{ $.Arg $id }} AS idx, {{ $.Arg $key_path }} AS key_path
    {{ else }}
        UNION ALL SELECT {{ $.Arg $id }}, {{ $.Arg $key_path }}
    {{ end }}
{{ end }}
) AS requested_keys
INNER JOIN {{ .TableName }} r ON r.{{ .Ident "key_path" }} = requested_keys.{{ .Ident "key_path" }}
ORDER BY requested_keys.{{ .Ident "idx" }};
