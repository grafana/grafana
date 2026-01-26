DELETE FROM {{ .Ident "resource" }}
WHERE {{ .Ident "group" }} = {{ .Arg .Group }}
AND {{ .Ident "resource" }} = {{ .Arg .Resource }}
AND {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
AND {{ .Ident "name" }} = {{ .Arg .Name }};
