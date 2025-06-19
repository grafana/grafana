SELECT
  {{ .Ident "created" }}
  {{ .Ident "message_type" }}
FROM
  {{ .Ident "secret_secure_value_outbox" }}
WHERE
  {{ .Ident "uid" }} = {{ .Arg .MessageID }}
;
