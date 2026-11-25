UPDATE
  {{ .Ident "secret_encrypted_value" }}
SET
  {{ .Ident "encrypted_data" }} = (
    CASE
    {{ range $i, $row := .Rows }}
    WHEN {{ $.Ident "namespace" }} = {{ $.Arg $.Namespace }} AND {{ $.Ident "name" }} = {{ $.Arg $row.Name }} AND {{ $.Ident "version" }} = {{ $.Arg $row.Version }} THEN {{ $.Arg $row.EncryptedData }}
    {{ end }}
    ELSE {{ .Ident "encrypted_data" }}
    END
  ),
  {{ .Ident "data_key_id" }} = (
    CASE
    {{ range $i, $row := .Rows }}
    WHEN {{ $.Ident "namespace" }} = {{ $.Arg $.Namespace }} AND {{ $.Ident "name" }} = {{ $.Arg $row.Name }} AND {{ $.Ident "version" }} = {{ $.Arg $row.Version }} THEN {{ $.Arg $row.DataKeyID }}
    {{ end }}
    ELSE {{ .Ident "data_key_id" }}
    END
  ),
  {{ .Ident "updated" }} = (
    CASE
    {{ range $i, $row := .Rows }}
    WHEN {{ $.Ident "namespace" }} = {{ $.Arg $.Namespace }} AND {{ $.Ident "name" }} = {{ $.Arg $row.Name }} AND {{ $.Ident "version" }} = {{ $.Arg $row.Version }} THEN {{ $.Arg $row.Updated }}
    {{ end }}
    ELSE {{ .Ident "updated" }}
    END
  )
WHERE {{ .Ident "namespace" }} = {{ .Arg .Namespace }} AND (
  {{ $first := true }}
  {{ range $i, $row := .Rows }}
  {{ if $first }}{{ $first = false }}{{ else }}OR {{ end }}({{ $.Ident "name" }} = {{ $.Arg $row.Name }} AND {{ $.Ident "version" }} = {{ $.Arg $row.Version }})
  {{ end }}
);
