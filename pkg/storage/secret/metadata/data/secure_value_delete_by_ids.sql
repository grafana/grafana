DELETE FROM {{ .Ident "secret_secure_value" }}
WHERE {{ .Ident "guid" }} IN ({{ .ArgList .SecureValueIDs }});