DELETE FROM {{ .Ident .TeamMemberTable }}
WHERE org_id = {{ .Arg .OrgID }}
  AND team_id = {{ .Arg .TeamID }}
