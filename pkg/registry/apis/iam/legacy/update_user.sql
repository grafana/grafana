UPDATE {{ .Ident .UserTable }} 
SET login = {{ .Arg .Command.Login }}, 
    email = {{ .Arg .Command.Email }}, 
    name = {{ .Arg .Command.Name }}, 
    is_admin = {{ .Arg .Command.IsAdmin }}, 
    is_disabled = {{ .Arg .Command.IsDisabled }}, 
    email_verified = {{ .Arg .Command.EmailVerified }}, 
    is_provisioned = {{ .Arg .Command.IsProvisioned }}, 
    updated = {{ .Arg .Command.Updated }},
    version = version + 1
WHERE uid = {{ .Arg .Command.UID }}
  AND org_id = {{ .Arg .Command.OrgID }}