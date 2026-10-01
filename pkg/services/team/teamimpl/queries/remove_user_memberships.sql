DELETE FROM {{ .Ident .TeamMemberTable }}
WHERE user_id = {{ .Arg .UserID }}
