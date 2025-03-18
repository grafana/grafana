SELECT
  {{ .Ident "namespace" }},
  {{ .Ident "group"     }},
  {{ .Ident "resource"  }},
  COUNT(*),
  MAX({{ .Ident "resource_version" }})
FROM {{ .Ident "resource" }}
WHERE 1 = 1
{{ if .Namespace }}
  AND {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
{{ end}}
{{ if .Folder }}
  AND {{ .Ident "folder" }} = {{ .Arg .Folder }}
{{ end}}
GROUP BY 
  {{ .Ident "namespace" }},
  {{ .Ident "group"     }},
  {{ .Ident "resource"  }}
;