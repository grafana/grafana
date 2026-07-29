{{ if eq .DialectName "sqlite" }}
UPDATE {{ .Ident .TeamMemberTable }} SET uid = printf('tm%09d', id) WHERE uid IS NULL OR uid = ''
{{ else if eq .DialectName "postgres" }}
UPDATE {{ .Ident .TeamMemberTable }} SET uid = 'tm' || lpad('' || id::text, 9, '0') WHERE uid IS NULL OR uid = ''
{{ else if eq .DialectName "mysql" }}
UPDATE {{ .Ident .TeamMemberTable }} SET uid = concat('tm', lpad(id, 9, '0')) WHERE uid IS NULL OR uid = ''
{{ end }}
