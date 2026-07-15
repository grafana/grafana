UPDATE {{ .Ident .QuotaTable }}
SET {{ .Ident .LimitColumn }} = {{ .Arg .Limit }},
    updated = {{ .Arg .Updated }}
WHERE id = {{ .Arg .QuotaID }}
