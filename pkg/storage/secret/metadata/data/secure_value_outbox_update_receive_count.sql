UPDATE 
  {{ .Ident "secret_secure_value_outbox" }}
SET
  {{ .Ident "receive_count" }} = {{ .Ident "receive_count" }} + 1
WHERE 
  {{ .Ident "uid" }} IN ({{ range $index, $messageID := .MessageIDs }}{{if gt $index 0}}, {{end}}{{ printf "%q" $messageID }}{{end}})
;