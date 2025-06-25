INSERT INTO {{ .Ident "resource" }}
SELECT 
  kv.{{ .Ident "guid" }},
  kv.{{ .Ident "resource_version" }},
  kv.{{ .Ident "group" }}, 
  kv.{{ .Ident "resource" }}, 
  kv.{{ .Ident "namespace" }}, 	
  kv.{{ .Ident "name" }},
  kv.{{ .Ident "value" }},
  kv.{{ .Ident "action" }},
  kv.{{ .Ident "label_set" }},
  kv.{{ .Ident "previous_resource_version" }},
  kv.{{ .Ident "folder" }}
FROM {{ .Ident "resource_history" }} AS kv
  INNER JOIN  (
    SELECT {{ .Ident "namespace" }}, {{ .Ident "group" }}, {{ .Ident "resource" }}, {{ .Ident "name" }},  max({{ .Ident "resource_version" }}) AS {{ .Ident "resource_version" }}
    FROM {{ .Ident "resource_history" }} AS mkv
    WHERE 1 = 1
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
    GROUP BY mkv.{{ .Ident "namespace" }}, mkv.{{ .Ident "group" }}, mkv.{{ .Ident "resource" }}, mkv.{{ .Ident "name" }} 
  ) AS maxkv
       ON maxkv.{{ .Ident "resource_version" }} = kv.{{ .Ident "resource_version" }}
      AND maxkv.{{ .Ident "namespace" }} = kv.{{ .Ident "namespace" }}
      AND maxkv.{{ .Ident "group" }}     = kv.{{ .Ident "group" }}
      AND maxkv.{{ .Ident "resource" }}  = kv.{{ .Ident "resource" }}
      AND maxkv.{{ .Ident "name" }}      = kv.{{ .Ident "name" }}
    WHERE kv.{{ .Ident "action" }}   != 3 
      {{ if .Key.Namespace }}
      AND kv.{{ .Ident "namespace" }} = {{ .Arg .Key.Namespace }}
      {{ end }}
      {{ if .Key.Group }}
      AND kv.{{ .Ident "group" }}     = {{ .Arg .Key.Group }}
      {{ end }}
      {{ if .Key.Resource }}
      AND kv.{{ .Ident "resource" }}  = {{ .Arg .Key.Resource }}
      {{ end }}
      {{ if .Key.Name }}
      AND kv.{{ .Ident "name" }}      = {{ .Arg .Key.Name }}
      {{ end }}
    ORDER BY kv.{{ .Ident "resource_version" }} ASC
;
