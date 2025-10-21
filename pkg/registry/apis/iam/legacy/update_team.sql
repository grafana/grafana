UPDATE {{ .Ident .TeamTable }}
SET name = {{ .Arg .Command.Name }},
    updated = {{ .Arg .Command.Updated }},
    email = {{ .Arg .Command.Email }},
    is_provisioned = {{ .Arg .Command.IsProvisioned }},
    external_uid = {{ .Arg .Command.ExternalUID }}
WHERE uid = {{ .Arg .Command.UID }}
