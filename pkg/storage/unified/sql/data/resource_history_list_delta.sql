SELECT
  {{ .Ident "guid" }},
  {{ .Ident "resource_version" }},
  {{ .Ident "namespace" }},
  {{ .Ident "group" }},
  {{ .Ident "resource" }},
  {{ .Ident "name" }},
  {{ .Ident "folder" }},
  {{ .Ident "value" }}
FROM {{ .Ident "resource_history" }} as rh
WHERE {{ .Ident "resource_version" }} > {{ .Arg .Request.SinceVersion }} -- list all new events since the given RV for the namespaced resource
AND {{ .Ident "namespace" }} = {{ .Arg .Request.Options.Key.Namespace }}
AND {{ .Ident "group" }}     = {{ .Arg .Request.Options.Key.Group }}
AND {{ .Ident "resource" }}  = {{ .Arg .Request.Options.Key.Resource }}
ORDER BY {{ .Ident "resource_version" }} ASC
