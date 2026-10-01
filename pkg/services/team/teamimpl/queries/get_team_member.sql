SELECT *
FROM {{ .Ident .TeamMemberTable }}
WHERE org_id = {{ .Arg .OrgID }}
  AND team_id = {{ .Arg .TeamID }}
  AND user_id = {{ .Arg .UserID }}
