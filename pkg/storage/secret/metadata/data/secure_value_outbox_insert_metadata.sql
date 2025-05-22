INSERT INTO {{ .Ident "secret_secure_value_outbox_metadata" }} (
  {{ .Ident "message_id"}},
  {{ .Ident "receive_count" }}
)
VALUES (
  {{ .Arg .Row.MessageID }},
  {{ .Arg .Row.ReceiveCount }}
);