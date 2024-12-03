SELECT
  {{ .Ident "namespace" }},
  {{ .Ident "group"     }},
  {{ .Ident "resource"  }},
  COUNT(*),
  MAX({{ .Ident "resource_version" }})
FROM {{ .Ident "resource" }}
GROUP BY 
  {{ .Ident "namespace" }},
  {{ .Ident "group"     }},
  {{ .Ident "resource"  }}
;