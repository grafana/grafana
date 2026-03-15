DELETE
FROM {{ .TableName }}
WHERE {{ .Ident "key_path" }} IN (
    {{ range $id, $key_path := .KeyPaths }}
        {{ if ne $id 0 }}, {{ end }}{{ $.Arg $key_path }}
    {{ end }}
);
