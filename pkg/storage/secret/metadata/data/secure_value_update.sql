UPDATE
  {{ .Ident "secret_secure_value" }}
SET
  {{ .Ident "guid" }} = {{ .Arg .Row.GUID }},
  {{ .Ident "name" }} = {{ .Arg .Row.Name }},
  {{ .Ident "namespace" }} = {{ .Arg .Row.Namespace }},
  {{ .Ident "annotations" }} = {{ .Arg .Row.Annotations }},
  {{ .Ident "labels" }} = {{ .Arg .Row.Labels }},
  {{ .Ident "created" }} = {{ .Arg .Row.Created }},
  {{ .Ident "created_by" }} = {{ .Arg .Row.CreatedBy }},
  {{ .Ident "updated" }} = {{ .Arg .Row.Updated }},
  {{ .Ident "updated_by" }} = {{ .Arg .Row.UpdatedBy }},
  {{ .Ident "status_phase" }} = {{ .Arg .Row.Phase }},
  {{ if .Row.Message.Valid }}
  {{ .Ident "status_message" }} = {{ .Arg .Row.Message.String }},
  {{ end }}
  {{ .Ident "description" }} = {{ .Arg .Row.Description }},
  {{ if .Row.Keeper.Valid }}
  {{ .Ident "keeper" }} = {{ .Arg .Row.Keeper.String }},
  {{ end }}
  {{ if .Row.Decrypters.Valid }}
  {{ .Ident "decrypters" }} = {{ .Arg .Row.Decrypters.String }},
  {{ end }}
  {{ if .Row.Ref.Valid }}
  {{ .Ident "ref" }} = {{ .Arg .Row.Ref.String }},
  {{ end }}
  {{ .Ident "external_id" }} = {{ .Arg .Row.ExternalID }}
WHERE 1 = 1 AND
  {{ .Ident "namespace" }} = {{ .Arg .Row.Namespace }} AND
  {{ .Ident "name" }} = {{ .Arg .Row.Name }}
;
