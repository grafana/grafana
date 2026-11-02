SELECT
  team.id AS id,
  team.uid,
  team.org_id,
  team.name AS name,
  team.email AS email,
  team.external_uid AS external_uid,
  team.is_provisioned AS is_provisioned,
  (
    SELECT COUNT(*)
    FROM {{ .Ident .TeamMemberTable }} AS team_member
    {{ if .FilteredUsers -}}
    INNER JOIN {{ .Ident .UserTable }} AS member_user ON team_member.user_id = member_user.id
    {{ end -}}
    WHERE team_member.team_id = team.id
    {{ if .FilteredUsers -}}
      AND member_user.login NOT IN ({{ .ArgList .FilteredUsers }})
    {{ end -}}
  ) AS member_count
FROM {{ .Ident .TeamTable }} AS team
WHERE team.org_id = {{ .Arg .OrgID }}
{{ if .NamePattern -}}
  AND team.name {{ if eq .DialectName "postgres" }}ILIKE{{ else }}LIKE{{ end }} {{ .Arg .NamePattern }}
{{ end -}}
{{ if .Name -}}
  AND LOWER(team.name) = LOWER({{ .Arg .Name }})
{{ end -}}
{{ if .TeamIDs -}}
  AND team.id IN ({{ .ArgList .TeamIDs }})
{{ end -}}
{{ if .UIDs -}}
  AND team.uid IN ({{ .ArgList .UIDs }})
{{ end -}}
{{ if .AccessTeamIDs -}}
  AND team.id IN ({{ .ArgList .AccessTeamIDs }})
{{ else if not .AccessAll -}}
  AND 1 = 0
{{ end -}}
ORDER BY
{{ if .Sorts -}}
  {{ range $index, $sort := .Sorts }}{{ if $index }}, {{ end }}{{ $sort }}{{ end }}
{{ else -}}
  team.name ASC
{{ end -}}
{{ if .Limit -}}
LIMIT {{ .Arg .Limit }} OFFSET {{ .Arg .Offset }}
{{ end -}}
