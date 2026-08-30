SELECT COUNT(*) AS count
FROM {{ .Ident .OrgUserTable }}
WHERE user_id = {{ .Arg .UserID }}
