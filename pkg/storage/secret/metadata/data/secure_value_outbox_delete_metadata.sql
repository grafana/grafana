DELETE FROM
  {{ .Ident "secret_secure_value_outbox_metadata" }}
WHERE
  {{ .Ident "message_id" }} = {{ .Arg .MessageID }}
;
