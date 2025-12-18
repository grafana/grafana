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
  {{ .Arg .Value }},
  {{ .Arg .GUID }},
  {{ .Arg .Group }},
  {{ .Arg .Resource }},
  {{ .Arg .Namespace }},
  {{ .Arg .Name }},
  {{ .Arg .Action }},
  {{ .Arg .Folder }},
  CASE WHEN {{ .Arg .Action }} = 1 THEN 0 ELSE (
    SELECT {{ .Ident "resource_version" }}
    FROM {{ .Ident "resource" }}
    WHERE {{ .Ident "group" }} = {{ .Arg .Group }}
    AND {{ .Ident "resource" }} = {{ .Arg .Resource }}
    AND {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
    AND {{ .Ident "name" }} = {{ .Arg .Name }}
    ORDER BY {{ .Ident "resource_version" }} DESC LIMIT 1
  ) END
);
