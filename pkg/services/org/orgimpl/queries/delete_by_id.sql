DELETE FROM {{ .Ident .Table }}
WHERE {{ .Ident .Column }} = {{ .Arg .ID }}
