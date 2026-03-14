DELETE FROM {{ .Ident "resource" }}
WHERE {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
AND {{ .Ident "group" }} = {{ .Arg .Group }}
AND {{ .Ident "resource" }} = {{ .Arg .Resource }};
