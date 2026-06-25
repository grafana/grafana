SELECT
  {{ .Ident "guid" }},
  {{ .Ident "gc_attempts" }}
FROM
  {{ .Ident "secret_secure_value" }}
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
  );
