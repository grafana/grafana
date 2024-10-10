INSERT INTO {{ .Ident "secure_value" }} (
    "uid", 
    "namespace", "name", "title",
    "manager", "path",
    "encrypted_provider", "encrypted_kid", 
    "encrypted_salt", "encrypted_value", "encrypted_time",
    "created", "created_by",
    "updated", "updated_by",
    "annotations", "labels", 
    "apis"
  )
  VALUES (
    {{ .Arg .Row.UID }},
    {{ .Arg .Row.Namespace }}, {{ .Arg .Row.Name }}, {{ .Arg .Row.Title }},
    {{ .Arg .Row.Manager }}, {{ .Arg .Row.Path }},
    {{ .Arg .Row.EncryptedProvider }}, {{ .Arg .Row.EncryptedKID }}, 
    {{ .Arg .Row.EncryptedSalt }}, {{ .Arg .Row.EncryptedValue }}, {{ .Arg .Row.Updated }},
    {{ .Arg .Row.Created }}, {{ .Arg .Row.CreatedBy }},
    {{ .Arg .Row.Updated }}, {{ .Arg .Row.UpdatedBy }},
    {{ .Arg .Row.Annotations }}, {{ .Arg .Row.Labels }},
    {{ .Arg .Row.APIs }}
  )
;
