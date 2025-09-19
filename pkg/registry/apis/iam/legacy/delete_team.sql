-- Delete from user table (org_user will be handled separately to avoid locking)
DELETE FROM {{ .Ident .TeamTable }} 
WHERE uid = {{ .Arg .Command.UID }}
AND org_id = {{ .Arg .Command.OrgID }}
