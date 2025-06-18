SELECT
  {{ .Ident "uid" }}
FROM {{ .Ident "secret_secure_value_outbox" }}
ORDER BY created DESC
LIMIT {{ .Arg .ReceiveLimit }}
;
