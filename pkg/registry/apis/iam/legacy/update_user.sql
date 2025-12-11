-- name: update_user
UPDATE {{ .Ident .UserTable }}
SET
	login = {{ .Arg .Command.Login }},
	email = {{ .Arg .Command.Email }},
	name = {{ .Arg .Command.Name }},
	is_admin = {{ .Arg .Command.IsAdmin }},
	is_disabled = {{ .Arg .Command.IsDisabled }},
	email_verified = {{ .Arg .Command.EmailVerified }},
	updated = {{ .Arg .Command.Updated }}
WHERE uid = {{ .Arg .Command.UID }}