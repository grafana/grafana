DELETE FROM {{ .Ident .TeamMemberTable }}
WHERE org_id = {{ .Arg .Command.OrgID }}
  AND uid IN ({{ .ArgList .Command.UIDs }})
