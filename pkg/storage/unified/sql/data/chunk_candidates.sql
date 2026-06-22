{{/* Select a bounded batch of rows for a collection from .Table, with each row's value byte size, so the caller can group deletes within a byte budget. */}}
SELECT {{ .Ident "guid" | .Into .Response.GUID }},
       OCTET_LENGTH({{ .Ident "value" }}) AS {{ .Ident "size" | .Into .Response.Size }}
FROM {{ .Ident .Table }}
WHERE {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
  AND {{ .Ident "group" }} = {{ .Arg .Group }}
  AND {{ .Ident "resource" }} = {{ .Arg .Resource }}
ORDER BY {{ .Ident "guid" }}
LIMIT {{ .Arg .BatchSize }};
