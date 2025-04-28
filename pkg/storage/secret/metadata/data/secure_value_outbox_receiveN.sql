SELECT
  {{ .Ident "uid" }},
  {{ .Ident "message_type" }},
  {{ .Ident "name" }},
  {{ .Ident "namespace" }},
  {{ .Ident "encrypted_secret" }},
  {{ .Ident "keeper_name" }},
  {{ .Ident "external_id" }},
  {{ .Ident "created" }}
FROM
  {{ .Ident "secret_secure_value_outbox" }}
ORDER BY
  {{ .Ident "created" }} ASC
LIMIT
  {{ .Arg .ReceiveLimit }}
{{ .SelectFor "UPDATE SKIP LOCKED" }}
;
