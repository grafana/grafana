INSERT INTO {{ .Ident "secret_secure_value" }} (
  {{ .Ident "guid" }},
  {{ .Ident "name" }},
  {{ .Ident "namespace" }},
  {{ .Ident "annotations" }},
  {{ .Ident "labels" }},
  {{ .Ident "created" }},
  {{ .Ident "created_by" }},
  {{ .Ident "updated" }},
  {{ .Ident "updated_by" }},
  {{ .Ident "status_phase" }},
  {{ if .Row.Message.Valid }}
  {{ .Ident "status_message" }},
  {{ end }}
  {{ .Ident "description" }},
  {{ if .Row.Keeper.Valid }}
  {{ .Ident "keeper" }},
  {{ end }}
  {{ if .Row.Decrypters.Valid }}
  {{ .Ident "decrypters" }},
  {{ end }}
  {{ if .Row.Ref.Valid }}
  {{ .Ident "ref" }},
  {{ end }}
  {{ .Ident "external_id" }}
) VALUES (
  {{ .Arg .Row.GUID }},
  {{ .Arg .Row.Name }},
  {{ .Arg .Row.Namespace }},
  {{ .Arg .Row.Annotations }},
  {{ .Arg .Row.Labels }},
  {{ .Arg .Row.Created }},
  {{ .Arg .Row.CreatedBy }},
  {{ .Arg .Row.Updated }},
  {{ .Arg .Row.UpdatedBy }},
  {{ .Arg .Row.Phase }},
  {{ if .Row.Message.Valid }}
  {{ .Arg .Row.Message }},
  {{ end }}
  {{ .Arg .Row.Description }},
  {{ if .Row.Keeper.Valid }}
  {{ .Arg .Row.Keeper }},
  {{ end }}
  {{ if .Row.Decrypters.Valid }}
  {{ .Arg .Row.Decrypters }},
  {{ end }}
  {{ if .Row.Ref.Valid }}
  {{ .Arg .Row.Ref }},
  {{ end }}
  {{ .Arg .Row.ExternalID }}
);
