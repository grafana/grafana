UPDATE {{ .Ident "secret_secure_value" }}
SET {{ .Ident "gc_attempts" }} = {{ .Ident "gc_attempts" }} + 1
WHERE 
  ({{ .Ident "namespace" }}, {{ .Ident "name" }}, {{ .Ident "version" }}) IN
  (
    {{range $index, $entry := .SecureValues}}
      {{ if gt $index 0 }}
        ,
      {{ end }}
      (
        {{ $.Arg $entry.Namespace }},
        {{ $.Arg $entry.Name }},
        {{ $.Arg $entry.Version }}
      )
    {{end}}
  ) 
  AND
  {{ .Ident "active" }} = FALSE