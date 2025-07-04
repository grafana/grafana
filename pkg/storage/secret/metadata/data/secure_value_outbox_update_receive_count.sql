UPDATE 
  {{ .Ident "secret_secure_value_outbox" }}
SET
  {{ .Ident "receive_count" }} = {{ .Ident "receive_count" }} + 1
WHERE 
  {{ .Ident "id" }} IN ({{ .ArgList .MessageIDs }})
;
