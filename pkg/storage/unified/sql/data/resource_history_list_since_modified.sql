SELECT
    {{.Ident "namespace"}},
    {{.Ident "group"}},
    {{.Ident "resource"}},
    {{.Ident "name"}},
    {{.Ident "resource_version"}},
    {{.Ident "action"}},
    {{.Ident "value"}}
--     {{.Ident "folder"}},
FROM resource_history
WHERE {{.Ident "namespace" }} = {{.Arg .Namespace }}
  AND {{.Ident "group" }} = {{.Arg .Group }}
  AND {{.Ident "resource" }} = {{.Arg .Resource }}
  AND {{.Ident "resource_version" }} > {{.Arg .SinceRv }} -- needs to be exclusive of the sinceRv
ORDER BY  {{.Ident "group" }} ASC, {{.Ident "resource" }} ASC, {{.Ident "name" }} ASC, {{.Ident "resource_version" }} DESC
