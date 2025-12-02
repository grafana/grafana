INSERT INTO {{ .Ident .TeamMemberTable }}
  (uid, team_id, user_id, org_id, created, updated, external, permission)
VALUES
  ({{ .Arg .Command.UID }}, {{ .Arg .Command.TeamID }}, {{ .Arg .Command.UserID }}, {{ .Arg .Command.OrgID }}, {{ .Arg .Command.Created }},
  {{ .Arg .Command.Updated }}, {{ .Arg .Command.External }}, {{ .Arg .Command.Permission }})
