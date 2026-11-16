-- Delete from user_auth table for a specific user
DELETE FROM {{ .Ident .UserAuthTable }}
WHERE user_id = {{ .Arg .UserID }}
