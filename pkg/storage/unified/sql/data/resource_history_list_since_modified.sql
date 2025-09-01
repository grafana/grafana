SELECT
    {{.Ident "namespace"}},
    {{.Ident "group"}},
    {{.Ident "resource"}},
    {{.Ident "name"}},
    {{.Ident "resource_version"}},
    {{.Ident "action"}},
    {{.Ident "value"}}
FROM resource_history
WHERE {{.Ident "namespace" }} = {{.Arg .Namespace }}
  AND {{.Ident "group" }} = {{.Arg .Group }}
  AND {{.Ident "resource" }} = {{.Arg .Resource }}
  AND {{.Ident "resource_version" }} > {{.Arg .SinceRv }} -- needs to exclude SinceRv
  AND {{.Ident "resource_version" }} <= {{.Arg .LatestRv }} -- needs to include LatestRv
ORDER BY {{.Ident "name" }} ASC, {{.Ident "resource_version" }} DESC
