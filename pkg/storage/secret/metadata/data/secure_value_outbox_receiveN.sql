SELECT
  {{ .Ident "request_id" }},
  {{ .Ident "uid" }},
  {{ .Ident "message_type" }},
  {{ .Ident "name" }},
  {{ .Ident "namespace" }},
  {{ .Ident "encrypted_secret" }},
  {{ .Ident "keeper_name" }},
  {{ .Ident "external_id" }},
  {{ .Ident "receive_count" }},
  {{ .Ident "created" }}
FROM
  {{ .Ident "secret_secure_value_outbox" }}
WHERE 
  {{ .Ident "uid" }} IN ({{ .ArgList .MessageIDs }})
ORDER BY
  {{ .Ident "created" }} ASC
{{ .SelectFor "UPDATE SKIP LOCKED" }}
;
