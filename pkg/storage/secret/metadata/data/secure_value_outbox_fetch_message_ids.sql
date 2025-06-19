SELECT
  {{ .Ident "id" }}
FROM {{ .Ident "secret_secure_value_outbox" }}
ORDER BY id ASC
LIMIT {{ .Arg .ReceiveLimit }}
;
