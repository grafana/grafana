{{/* Delete a sub-batch of rows by guid within a collection from .Table. */}}
DELETE FROM {{ .Ident .Table }}
WHERE {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
  AND {{ .Ident "group" }} = {{ .Arg .Group }}
  AND {{ .Ident "resource" }} = {{ .Arg .Resource }}
  AND {{ .Ident "guid" }} IN (
    {{- range $i, $guid := .GUIDs -}}
    {{- if $i }}, {{ end -}}
    {{ $.Arg $guid }}
    {{- end -}}
  );
