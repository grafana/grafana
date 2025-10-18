DELETE FROM {{ .Ident .TeamTable }} 
WHERE uid = {{ .Arg .Command.UID }}
