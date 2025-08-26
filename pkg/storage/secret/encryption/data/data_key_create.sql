INSERT INTO {{ .Ident "secret_data_key" }} (
  {{ .Ident "uid" }},
  {{ .Ident "namespace" }},
  {{ .Ident "label" }},
  {{ .Ident "provider" }},
  {{ .Ident "encrypted_data" }},
  {{ .Ident "active" }},
  {{ .Ident "created" }},
  {{ .Ident "updated" }}
) VALUES (
  {{ .Arg .Row.UID }},
  {{ .Arg .Row.Namespace }},
  {{ .Arg .Row.Label }},
  {{ .Arg .Row.Provider }},
  {{ .Arg .Row.EncryptedData }},
  {{ .Arg .Row.Active }},
  {{ .Arg .Row.Created }},
  {{ .Arg .Row.Updated }}
);
