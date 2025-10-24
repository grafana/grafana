DELETE FROM {{ .Ident .TeamMemberTable }} 
WHERE uid = {{ .Arg .Command.UID }}
