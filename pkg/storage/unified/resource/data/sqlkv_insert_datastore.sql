INSERT INTO {{ .Ident .TableName }}
(
  {{ .Ident "guid" }},
  {{ .Ident "key_path" }},
  {{ .Ident "value" }},
  {{ .Ident "group" }},
  {{ .Ident "resource" }},
  {{ .Ident "namespace" }},
  {{ .Ident "name" }},
  {{ .Ident "action" }}
)
VALUES (
  {{ .Arg .GUID }},
  {{ .Arg .KeyPath }},
  COALESCE({{ .Arg .Value }}, ""),
  {{ .Arg .Group }},
  {{ .Arg .Resource }},
  {{ .Arg .Namespace }},
  {{ .Arg .Name }},
  {{ .Arg .Action }}
);
