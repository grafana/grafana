UPDATE
  {{ .Ident "secret_encrypted_value" }}
SET
  {{ .Ident "encrypted_data" }} = (
    CASE
    {{ range $i, $row := .Rows }}
    WHEN {{ $.Ident "namespace" }} = {{ $.Arg $.Namespace }} AND {{ $.Ident "name" }} = {{ $.Arg $row.Name }} AND {{ $.Ident "version" }} = {{ $.Arg $row.Version }} THEN {{ $.Arg $row.EncryptedData }}
    {{ end }}
    END
  ),
  {{ .Ident "data_key_id" }} = (
    CASE
    {{ range $i, $row := .Rows }}
    WHEN {{ $.Ident "namespace" }} = {{ $.Arg $.Namespace }} AND {{ $.Ident "name" }} = {{ $.Arg $row.Name }} AND {{ $.Ident "version" }} = {{ $.Arg $row.Version }} THEN {{ $.Arg $row.DataKeyID }}
    {{ end }}
    END
  ),
  {{ .Ident "updated" }} = (
    CASE
    {{ range $i, $row := .Rows }}
    WHEN {{ $.Ident "namespace" }} = {{ $.Arg $.Namespace }} AND {{ $.Ident "name" }} = {{ $.Arg $row.Name }} AND {{ $.Ident "version" }} = {{ $.Arg $row.Version }} THEN {{ $.Arg $row.Updated }}
    {{ end }}
    END
  )
WHERE ({{ .Ident "namespace" }}, {{ .Ident "name" }}, {{ .Ident "version" }}) IN (
  VALUES
  {{ $first := true }}
  {{ range $i, $row := .Rows }}
  {{ if $first }}{{ $first = false }}{{ else }}, {{ end }}({{ $.Arg $.Namespace }}, {{ $.Arg $row.Name }}, {{ $.Arg $row.Version }})
  {{ end }}
);
