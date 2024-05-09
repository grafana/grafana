UPDATE {{ .Ident "kind_version" }}
  SET {{ .Ident "resource_version" }} = {{ .Arg .PreviousResourceVersion }} + 1
  WHERE 1 = 1
    AND {{ .Ident "group" }}            = {{ .Arg .Entity.Group }}
    AND {{ .Ident "group_version" }}    = {{ .Arg .Entity.GroupVersion }}
    AND {{ .Ident "resource" }}         = {{ .Arg .Entity.Resource }}
    AND {{ .Ident "resource_version" }} = {{ .Arg .PreviousResourceVersion }}
;
