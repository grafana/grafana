WITH updates AS (
  {{ .Arg .SelectStatements }}
)
UPDATE {{ .Ident "secret_data_key" }}
JOIN updates ON {{ .Ident "secret_data_key" }}.uid = updates.uid
SET
  {{ .Ident "secret_data_key" }}.label = updates.label,
  {{ .Ident "secret_data_key" }}.encrypted_data = updates.encrypted_data,
  {{ .Ident "secret_data_key" }}.provider = {{ .Arg .Provider }},
  {{ .Ident "secret_data_key" }}.updated = {{ .Arg .Updated }}
;
