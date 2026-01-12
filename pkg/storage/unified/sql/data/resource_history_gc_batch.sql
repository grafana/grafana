DELETE FROM {{ .Ident "resource_history" }} h
WHERE h.{{ .Ident "group" }} = {{ .Arg .Group }}
  AND h.{{ .Ident "resource" }} = {{ .Arg .Resource }}
  AND h.{{ .Ident "action" }} = 3
  AND h.{{ .Ident "resource_version" }} < {{ .Arg .CutoffTimestamp }}
  AND NOT EXISTS (
    SELECT 1 FROM {{ .Ident "resource" }} r
    WHERE r.{{ .Ident "namespace" }} = h.{{ .Ident "namespace" }}
      AND r.{{ .Ident "group" }} = h.{{ .Ident "group" }}
      AND r.{{ .Ident "resource" }} = h.{{ .Ident "resource" }}
      AND r.{{ .Ident "name" }} = h.{{ .Ident "name" }}
  )
LIMIT {{ .Arg .BatchSize }};
