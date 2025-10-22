-- name: update_org_user
UPDATE {{ .Ident .OrgUserTable }}
SET
	role = {{ .Arg .Command.Role }},
	updated = {{ .Arg .Command.Updated }}
WHERE org_id = {{ .Arg .Command.OrgID }} AND user_id = {{ .Arg .Command.UserID }}
