UPDATE {{ .Ident .QuotaTable }}
SET {{ .Ident "limit" }} = {{ .Arg .Limit }},
    updated = {{ .Arg .Updated }}
WHERE id = {{ .Arg .QuotaID }}
