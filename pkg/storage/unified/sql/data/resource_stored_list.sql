SELECT DISTINCT
  {{ .Ident "namespace" }},
  {{ .Ident "group"     }},
  {{ .Ident "resource"  }}
FROM {{ .Ident "resource" }}
WHERE 1 = 1
{{ if .Namespace }}
  AND {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
{{ end}}
{{ if .Group }}
  AND {{ .Ident "group" }} = {{ .Arg .Group }}
{{ end}}
{{ if .Resource }}
  AND {{ .Ident "resource" }} = {{ .Arg .Resource }}
{{ end}}
ORDER BY
  {{ .Ident "namespace" }},
  {{ .Ident "group"     }},
  {{ .Ident "resource"  }}
;
