INSERT INTO {{ .Ident "resource_history" }}
(
  {{ .Ident "value" }},
  {{ .Ident "guid" }},
  {{ .Ident "group" }},
  {{ .Ident "resource" }},
  {{ .Ident "namespace" }},
  {{ .Ident "name" }},
  {{ .Ident "action" }},
  {{ .Ident "folder" }}
)
VALUES (
  {{ .Arg .Value }},
  {{ .Arg .GUID }},
  {{ .Arg .Group }},
  {{ .Arg .Resource }},
  {{ .Arg .Namespace }},
  {{ .Arg .Name }},
  {{ .Arg .Action }},
  {{ .Arg .Folder }}
);
