INSERT INTO {{ .Ident "secret_encrypted_value" }} (
  {{ .Ident "uid" }},
  {{ .Ident "namespace" }},
  {{ .Ident "encrypted_data" }},
  {{ .Ident "created" }},
  {{ .Ident "updated" }}
) VALUES (
  {{ .Arg .Row.UID }},
  {{ .Arg .Row.Namespace }},
  {{ .Arg .Row.EncryptedData }},
  {{ .Arg .Row.Created }},
  {{ .Arg .Row.Updated }}
);
