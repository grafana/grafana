INSERT INTO {{ .Ident .TeamMemberTable }}
  ({{ .Ident "uid" }}, {{ .Ident "team_id" }}, {{ .Ident "user_id" }}, {{ .Ident "org_id" }}, {{ .Ident "created" }}, {{ .Ident "updated" }}, {{ .Ident "external" }}, {{ .Ident "permission" }})
VALUES
  ({{ .Arg .Command.UID }}, {{ .Arg .Command.TeamID }}, {{ .Arg .Command.UserID }}, {{ .Arg .Command.OrgID }}, {{ .Arg .Command.Created }},
  {{ .Arg .Command.Updated }}, {{ .Arg .Command.External }}, {{ .Arg .Command.Permission }})
