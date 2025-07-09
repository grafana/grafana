SELECT
  {{ .Ident "request_id" }},
  {{ .Ident "id" }},
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
  {{ .Ident "id" }} IN ({{ .ArgList .MessageIDs }})
ORDER BY
  {{ .Ident "id" }} ASC
{{ .SelectFor "UPDATE SKIP LOCKED" }}
;
