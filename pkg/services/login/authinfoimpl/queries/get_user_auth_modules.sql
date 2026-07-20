SELECT auth_module
FROM {{ .Ident .UserAuthTable }}
WHERE user_id = {{ .Arg .UserID }}
ORDER BY created DESC
