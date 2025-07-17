-- Delete from org_user table for a specific user
DELETE FROM {{ .Ident .OrgUserTable }} 
WHERE user_id = {{ .Arg .UserID }}
