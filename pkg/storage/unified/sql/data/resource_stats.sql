SELECT
  {{ .Ident "namespace" }},
  {{ .Ident "group"     }},
  {{ .Ident "resource"  }},
  COUNT(*),
  {{ .Ident "resource_version" }}
FROM {{ .Ident "resource" }}
GROUP BY 
  {{ .Ident "namespace" }},
  {{ .Ident "group"     }},
  {{ .Ident "resource"  }}
ORDER BY
  {{ .Ident "resource_version" }} desc
;