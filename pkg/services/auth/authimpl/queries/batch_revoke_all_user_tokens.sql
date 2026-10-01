DELETE FROM {{ .Ident .TokenTable }}
WHERE user_id IN ({{ .ArgList .UserIDs }})
