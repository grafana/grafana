INSERT INTO {{ .Ident .TeamMemberTable }}
  (team_id, user_id, created, updated, external, permission)
VALUES
  ({{ .Arg .Command.TeamID }}, {{ .Arg .Command.UserID }}, {{ .Arg .Command.Created }},
  {{ .Arg .Command.Updated }}, {{ .Arg .Command.External }}, {{ .Arg .Command.Permission }})
