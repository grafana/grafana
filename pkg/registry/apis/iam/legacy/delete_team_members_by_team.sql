DELETE FROM {{ .Ident .TeamMemberTable }}
WHERE org_id = {{ .Arg .Command.OrgID }}
  AND team_id = {{ .Arg .Command.TeamID }}
