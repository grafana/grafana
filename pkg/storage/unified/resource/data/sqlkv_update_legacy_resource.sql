UPDATE {{ .Ident "resource" }}
SET
  {{ .Ident "value" }} = {{ .Arg .Value }},
  {{ .Ident "action" }} = {{ .Arg .Action }},
  {{ .Ident "folder" }} = { .Arg .Folder }}
WHERE {{ .Ident "group" }} = {{ .Arg .Group }}
AND {{ .Ident "resource" }} = {{ .Arg .Resource }}
AND {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
AND {{ .Ident "name" }} = {{ .Arg .Name }};
