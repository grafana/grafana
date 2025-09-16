-- Delete from user table (org_user will be handled separately to avoid locking)
DELETE FROM {{ .Ident .UserTable }} 
WHERE uid = {{ .Arg .Command.UID }}
