SELECT
  {{ .Ident "message_id" }},
  {{ .Ident "receive_count" }}
FROM
  {{ .Ident "secret_secure_value_outbox_metadata" }}
WHERE 
  {{ .Ident "message_id" }} IN ({{ range $index, $messageID := .MessageIDs }}{{if gt $index 0}}, {{end}}{{ printf "%q" $messageID }}{{end}})
;
