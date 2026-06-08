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
{{ if .Group }}
  AND {{ .Ident "group" }} = {{ .Arg .Group }}
{{ end}}
{{ if .Resource }}
  AND {{ .Ident "resource" }} = {{ .Arg .Resource }}
{{ end}}
{{ if .Folders }}
  AND {{ .Ident "folder" }} IN ({{ .ArgList .Folders }})
{{ end}}
GROUP BY 
  {{ .Ident "namespace" }},
  {{ .Ident "group"     }},
  {{ .Ident "resource"  }}
;