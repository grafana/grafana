INSERT INTO {{ .Ident "secret_secure_value_outbox" }} (
  {{ .Ident "uid" }},
  {{ .Ident "message_type" }},
  {{ .Ident "name" }},
  {{ .Ident "namespace" }},
{{ if .Row.EncryptedSecret.Valid }}
  {{ .Ident "encrypted_secret" }},
{{ end }}
{{ if .Row.KeeperName.Valid }}
  {{ .Ident "keeper_name" }},
{{ end }}
{{ if .Row.ExternalID.Valid }}
  {{ .Ident "external_id" }},
{{ end }}
  {{ .Ident "created" }}
) VALUES (
  {{ .Arg .Row.MessageID }},
  {{ .Arg .Row.MessageType }},
  {{ .Arg .Row.Name }},
  {{ .Arg .Row.Namespace }},
{{ if .Row.EncryptedSecret.Valid }}
  {{ .Arg .Row.EncryptedSecret.String }},
{{ end }}
{{ if .Row.KeeperName.Valid }}
  {{ .Arg .Row.KeeperName.String }},
{{ end }}
{{ if .Row.ExternalID.Valid }}
  {{ .Arg .Row.ExternalID.String }},
{{ end }}
  {{ .Arg .Row.Created }}
);
