INSERT INTO {{ .Ident .UserTable }}
  (uid, version, login, name, org_id, is_admin, is_disabled, email_verified,
   is_provisioned, is_service_account, salt, rands, created, updated, last_seen_at)
VALUES
  ({{ .Arg .Command.UID }}, 0, {{ .Arg .Command.UID }}, {{ .Arg .Command.Name }},
   {{ .Arg .Command.OrgID }}, false, {{ .Arg .Command.IsDisabled }}, false,
   false, true, '', '', {{ .Arg .Command.Created }}, {{ .Arg .Command.Updated }}, {{ .Arg .Command.LastSeenAt }})
