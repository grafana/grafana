DELETE FROM
  {{ .Ident "secret_secure_value_outbox" }}
WHERE
  {{ .Ident "id" }} = {{ .Arg .MessageID }}
;
