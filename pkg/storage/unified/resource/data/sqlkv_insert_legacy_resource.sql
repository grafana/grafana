INSERT INTO {{ .Ident "resource" }}
(
  {{ .Ident "value" }},
  {{ .Ident "guid" }},
  {{ .Ident "group" }},
  {{ .Ident "resource" }},
  {{ .Ident "namespace" }},
  {{ .Ident "name" }},
  {{ .Ident "action" }},
  {{ .Ident "folder" }},
  {{ .Ident "previous_resource_version" }}
)
VALUES (
  (SELECT {{ .Ident "value" }} FROM {{ .Ident "resource_history" }} WHERE {{ .Ident "guid" }} = {{ .Arg .GUID }}),
  {{ .Arg .GUID }},
  {{ .Arg .Group }},
  {{ .Arg .Resource }},
  {{ .Arg .Namespace }},
  {{ .Arg .Name }},
  {{ .Arg .Action }},
  {{ .Arg .Folder }},
  {{ .Arg .PreviousRV }}
);
