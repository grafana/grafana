INSERT INTO {{ .Ident .UserTable }} 
  (uid, version, login, email, name, org_id, is_admin, is_disabled, email_verified, 
   is_provisioned, is_service_account, salt, rands, created, updated, last_seen_at)
VALUES 
  ({{ .Arg .Command.UID }}, 0, {{ .Arg .Command.Login }}, {{ .Arg .Command.Email }}, 
   {{ .Arg .Command.Name }}, {{ .Arg .Command.OrgID }}, {{ .Arg .Command.IsAdmin }}, 
   {{ .Arg .Command.IsDisabled }}, {{ .Arg .Command.EmailVerified }}, 
   {{ .Arg .Command.IsProvisioned }}, false, {{ .Arg .Command.Salt }}, {{ .Arg .Command.Rands }}, 
   {{ .Arg .Command.Created }}, {{ .Arg .Command.Updated }}, {{ .Arg .Command.LastSeenAt }})
