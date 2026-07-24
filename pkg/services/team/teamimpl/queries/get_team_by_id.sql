SELECT
  team.id as id,
  team.uid,
  team.org_id,
  team.name as name,
  team.email as email,
  team.external_uid as external_uid,
  team.is_provisioned as is_provisioned,
  {{ if .FilteredUsers -}}
  (SELECT COUNT(*) FROM {{ .Ident .TeamMemberTable }}
    INNER JOIN {{ .Ident .UserTable }} ON team_member.user_id = {{ .Ident "user" }}.id
    WHERE team_member.team_id = team.id AND {{ .Ident "user" }}.login NOT IN ({{ range $i, $u := .FilteredUsers }}{{ if $i }}, {{ end }}?{{ end }})) AS member_count
  {{- else -}}
  (SELECT COUNT(*) FROM {{ .Ident .TeamMemberTable }} WHERE team_member.team_id = team.id) AS member_count
  {{- end }}
FROM {{ .Ident .TeamTable }} as team
{{ if .ByUID -}}
WHERE team.org_id = ? and team.uid = ?
{{- else -}}
WHERE team.org_id = ? and team.id = ?
{{- end }}
