SELECT
    {{ .Ident "guid"  }},
    {{ .Ident "value" }},
    {{ .Ident "group" }},
    {{ .Ident "resource" }},
    {{ .Ident "previous_resource_version" }}
 FROM {{ .Ident "resource_history" }}
WHERE {{ .Ident "action" }} = 3
  AND {{ .Ident "value" }} LIKE {{ .Arg .MarkerQuery }};