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
{{ if and .Folder (not .Folders) }}
  AND {{ .Ident "folder" }} = {{ .Arg .Folder }}
{{ end}}
{{ if .Folders }}
  AND {{ .Ident "folder" }} IN ({{ .ArgList .Folders }}{{ if .Folder }}, {{ .Arg .Folder }}{{ end }})
{{ end}}
GROUP BY 
  {{ .Ident "namespace" }},
  {{ .Ident "group"     }},
  {{ .Ident "resource"  }}
;