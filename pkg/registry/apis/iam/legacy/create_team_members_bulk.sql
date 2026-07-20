INSERT INTO {{ .Ident .TeamMemberTable }}
  (uid, team_id, user_id, org_id, created, updated, external, permission)
VALUES
{{- range $i, $m := .Command.Members }}
  {{- if $i }},{{ end }}
  ({{ $.Arg $m.UID }}, {{ $.Arg $m.TeamID }}, {{ $.Arg $m.UserID }}, {{ $.Arg $m.OrgID }}, {{ $.Arg $m.Created }}, {{ $.Arg $m.Updated }}, {{ $.Arg $m.External }}, {{ $.Arg $m.Permission }})
{{- end }}
