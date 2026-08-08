SELECT 1
FROM {{ .Ident .OrgTable }}
WHERE id = {{ .Arg .OrgID }}
