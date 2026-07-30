UPDATE {{ .Ident .TokenTable }}
SET last_used_at = {{ .Arg .Command.LastUsedAt }}
WHERE org_id = {{ .Arg .Command.OrgID }}
  AND id = {{ .Arg .Command.ID }}
