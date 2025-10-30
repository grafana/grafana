UPDATE {{ .Ident .TeamMemberTable }}
SET permission = {{ .Arg .Command.Permission }},
    updated = {{ .Arg .Command.Updated }}
WHERE uid = {{ .Arg .Command.UID }}
