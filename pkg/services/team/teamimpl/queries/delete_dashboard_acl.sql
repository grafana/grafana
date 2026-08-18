DELETE FROM {{ .Ident .DashboardACLTable }}
WHERE org_id = {{ .Arg .OrgID }}
  AND team_id = {{ .Arg .TeamID }}
