SELECT user_id, auth_module
FROM {{ .Ident .UserAuthTable }}
WHERE user_id IN ({{ .ArgList .UserIDs }})
ORDER BY created
