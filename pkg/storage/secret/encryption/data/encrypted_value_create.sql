INSERT INTO {{ .Ident "secret_encrypted_value" }} (
  {{ .Ident "namespace" }},
  {{ .Ident "name" }},
  {{ .Ident "version" }},
  {{ .Ident "encrypted_data" }},
  {{ .Ident "data_key_id" }},
  {{ .Ident "created" }},
  {{ .Ident "updated" }}
) VALUES (
  {{ .Arg .Row.Namespace }},
  {{ .Arg .Row.Name }},
  {{ .Arg .Row.Version }},
  {{ .Arg .Row.EncryptedData }},
  {{ .Arg .Row.DataKeyID }},
  {{ .Arg .Row.Created }},
  {{ .Arg .Row.Updated }}
);
