INSERT INTO {{ .Ident .TeamTable }}
  (uid, name, org_id, created, updated, email, is_provisioned, external_uid)
VALUES
  ({{ .Arg .Command.UID }}, {{ .Arg .Command.Name }}, {{ .Arg .Command.OrgID }}, {{ .Arg .Command.Created }},
  {{ .Arg .Command.Updated }}, {{ .Arg .Command.Email }}, {{ .Arg .Command.IsProvisioned }},
  {{ .Arg .Command.ExternalUID }})
