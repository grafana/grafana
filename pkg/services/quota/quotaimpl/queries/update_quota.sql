UPDATE {{ .Ident .QuotaTable }}
SET {{ .Ident "limit" }} = {{ .Arg .Quota.Limit }},
    updated = {{ .Arg .Quota.Updated }}
WHERE id = {{ .Arg .Quota.Id }}
