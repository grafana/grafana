SELECT
    {{.Ident "guid"}},
    {{.Ident "resource_version"}},
    {{.Ident "namespace"}},
    {{.Ident "group"}},
    {{.Ident "resource"}},
    {{.Ident "name"}},
    {{.Ident "folder"}},
    {{.Ident "value"}},
    {{.Ident "action"}}
FROM resource_history
WHERE {{.Ident "namespace" }} = {{.Arg .Namespace }}
  AND {{.Ident "group" }} = {{.Arg .Group }}
  AND {{.Ident "resource" }} = {{.Arg .Resource }}
  AND {{.Ident "resource_version" }} > {{.Arg .SinceRv }} -- needs to be exclusive of the sinceRv
ORDER BY {{.Ident "resource_version" }}, {{.Ident "group" }}, {{.Ident "resource" }}, {{.Ident "name" }}
  DESC

