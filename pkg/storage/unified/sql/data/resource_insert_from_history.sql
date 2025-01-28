
INSERT INTO {{ .Ident "resource" }}
SELECT 
  mkv.{{ .Ident "guid" }},
  max({{ .Ident "resource_version" }}) AS {{ .Ident "resource_version" }},
  mkv.{{ .Ident "group" }}, 
  mkv.{{ .Ident "resource" }}, 
  mkv.{{ .Ident "namespace" }}, 	
  mkv.{{ .Ident "name" }},
  mkv.{{ .Ident "value" }},
  mkv.{{ .Ident "action" }},
  mkv.{{ .Ident "label_set" }},
  mkv.{{ .Ident "previous_resource_version" }},
  mkv.{{ .Ident "folder" }}
FROM {{ .Ident "resource_history" }} AS mkv
WHERE {{ .Ident "action" }} != 3
  {{ if .Key.Namespace }}
  AND {{ .Ident "namespace" }} = {{ .Arg .Key.Namespace }}
  {{ end }}
  {{ if .Key.Group }}
  AND {{ .Ident "group" }}     = {{ .Arg .Key.Group }}
  {{ end }}
  {{ if .Key.Resource }}
  AND {{ .Ident "resource" }}  = {{ .Arg .Key.Resource }}
  {{ end }}
  {{ if .Key.Name }}
  AND {{ .Ident "name" }}      = {{ .Arg .Key.Name }}
  {{ end }}
GROUP BY 
	mkv.{{ .Ident "namespace" }}, 
	mkv.{{ .Ident "group" }}, 
	mkv.{{ .Ident "resource" }}, 
	mkv.{{ .Ident "name" }},
	mkv.{{ .Ident "guid" }} 
ORDER BY resource_version ASC
;

