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
  {{ .Ident "active" }},
  {{ .Ident "version" }},
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
  {{ if .Row.OwnerReferenceAPIVersion.Valid }}
  {{ .Ident "owner_reference_api_version" }},
  {{ end }}
  {{ if .Row.OwnerReferenceKind.Valid }}
  {{ .Ident "owner_reference_kind" }},
  {{ end }}
  {{ if .Row.OwnerReferenceName.Valid }}
  {{ .Ident "owner_reference_name" }},
  {{ end }}
  {{ if .Row.OwnerReferenceUID.Valid }}
  {{ .Ident "owner_reference_uid" }},
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
  {{ .Arg .Row.Active }},
  {{ .Arg .Row.Version }},
  {{ .Arg .Row.Description }},
  {{ if .Row.Keeper.Valid }}
  {{ .Arg .Row.Keeper.String }},
  {{ end }}
  {{ if .Row.Decrypters.Valid }}
  {{ .Arg .Row.Decrypters.String }},
  {{ end }}
  {{ if .Row.Ref.Valid }}
  {{ .Arg .Row.Ref.String }},
  {{ end }}
  {{ if .Row.OwnerReferenceAPIVersion.Valid }}
  {{ .Arg .Row.OwnerReferenceAPIVersion.String }},
  {{ end }}
  {{ if .Row.OwnerReferenceKind.Valid }}
  {{ .Arg .Row.OwnerReferenceKind.String }},
  {{ end }}
  {{ if .Row.OwnerReferenceName.Valid }}
  {{ .Arg .Row.OwnerReferenceName.String }},
  {{ end }}
  {{ if .Row.OwnerReferenceUID.Valid }}
  {{ .Arg .Row.OwnerReferenceUID.String }},
  {{ end }}
  {{ .Arg .Row.ExternalID }}
);