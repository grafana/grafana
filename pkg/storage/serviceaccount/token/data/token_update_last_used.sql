UPDATE {{ .Ident "serviceaccount_token" }}
SET {{ .Ident "last_used_at" }} = {{ .Arg .LastUsedAt }}
WHERE {{ .Ident "id" }} = {{ .Arg .ID }}
;
