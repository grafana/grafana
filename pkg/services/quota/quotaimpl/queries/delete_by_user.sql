DELETE FROM {{ .Ident .QuotaTable }}
WHERE user_id = {{ .Arg .UserID }}
