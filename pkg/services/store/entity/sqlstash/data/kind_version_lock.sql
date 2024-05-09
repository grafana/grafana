SELECT {{ .Ident "resource_version" }}
  FROM {{ .Ident "kind_version" }}
  WHERE 1 = 1
    AND {{ .Ident "group" }}         = {{ .Arg .Entity.Group }}
    AND {{ .Ident "group_version" }} = {{ .Arg .Entity.GroupVersion }}
    AND {{ .Ident "resource" }}      = {{ .Arg .Entity.Resource }}
  {{ .SelectFor "UPDATE" }}
;
