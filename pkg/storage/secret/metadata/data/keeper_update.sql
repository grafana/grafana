UPDATE {{ .Ident "secret_keeper" }} (
  {{ .Ident "guid" }} = {{ .Arg .Row.GUID }},
  {{ .Ident "name" }} = {{ .Arg .Row.Name }},
  {{ .Ident "namespace" }} = {{ .Arg .Row.Namespace }},
  {{ .Ident "annotations" }} = {{ .Arg .Row.Annotations }},
  {{ .Ident "labels" }} = {{ .Arg .Row.Labels }},
  {{ .Ident "created" }} = {{ .Arg .Row.Created }},
  {{ .Ident "created_by" }} = {{ .Arg .Row.CreatedBy }},
  {{ .Ident "updated" }} = {{ .Arg .Row.Updated }},
  {{ .Ident "updated_by" }} = {{ .Arg .Row.UpdatedBy }},
  {{ .Ident "title" }} = {{ .Arg .Row.Title }},
  {{ .Ident "type" }} = {{ .Arg .Row.Type }},
  {{ .Ident "payload" }} = {{ .Arg .Row.Payload }}
)
WHERE
  {{ .Ident "name" }} = {{ .Arg .Row.Name }} AND
  {{ .Ident "namespace" }}= {{ .Arg .Row.Namespace }}
;
