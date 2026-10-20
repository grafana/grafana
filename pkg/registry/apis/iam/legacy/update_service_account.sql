UPDATE {{ .Ident .UserTable }}
SET
	name = {{ .Arg .Command.Name }},
	is_disabled = {{ .Arg .Command.IsDisabled }},
	updated = {{ .Arg .Command.Updated }}
WHERE uid = {{ .Arg .Command.UID }}
  AND org_id = {{ .Arg .Command.OrgID }}
  AND is_service_account
