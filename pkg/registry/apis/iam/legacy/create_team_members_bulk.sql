INSERT INTO {{ .Ident .TeamMemberTable }}
  ({{ .Ident "uid" }}, {{ .Ident "team_id" }}, {{ .Ident "user_id" }}, {{ .Ident "org_id" }}, {{ .Ident "created" }}, {{ .Ident "updated" }}, {{ .Ident "external" }}, {{ .Ident "permission" }})
VALUES
{{- range $i, $m := .Command.Members }}
  {{- if $i }},{{ end }}
  ({{ $.Arg $m.UID }}, {{ $.Arg $m.TeamID }}, {{ $.Arg $m.UserID }}, {{ $.Arg $m.OrgID }}, {{ $.Arg $m.Created }}, {{ $.Arg $m.Updated }}, {{ $.Arg $m.External }}, {{ $.Arg $m.Permission }})
{{- end }}
