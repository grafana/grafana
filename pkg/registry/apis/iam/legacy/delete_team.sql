DELETE FROM {{ .Ident .TeamTable }} 
WHERE uid = {{ .Arg .Command.UID }}
AND org_id = {{ .Arg .Command.OrgID }}
