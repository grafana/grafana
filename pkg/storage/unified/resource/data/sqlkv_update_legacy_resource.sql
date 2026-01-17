UPDATE {{ .Ident "resource" }}
SET
  {{ .Ident "guid" }} = {{ .Arg .GUID }},
  {{ .Ident "value" }} = (SELECT {{ .Ident "value" }} FROM {{ .Ident "resource_history" }} WHERE {{ .Ident "guid" }} = {{ .Arg .GUID }}),
  {{ .Ident "action" }} = {{ .Arg .Action }},
  {{ .Ident "folder" }} = {{ .Arg .Folder }},
  {{ .Ident "previous_resource_version" }} = {{ .Arg .PreviousRV }}
WHERE {{ .Ident "group" }} = {{ .Arg .Group }}
AND {{ .Ident "resource" }} = {{ .Arg .Resource }}
AND {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
AND {{ .Ident "name" }} = {{ .Arg .Name }};
