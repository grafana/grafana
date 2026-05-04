SELECT
    s.id,
    s.org_id,
    s.name,
    s.key,
    s.delete_key,
    s.user_id,
    s.external,
    s.external_url,
    s.dashboard_encrypted,
    s.expires,
    s.created,
    s.updated
FROM
    {{ .Ident .SnapshotTable }} as s
WHERE
    s.org_id = {{ .Arg .Query.OrgID }}
    {{ if .Query.LastID }}
    AND s.id > {{ .Arg .Query.LastID }}
    {{ end }}
ORDER BY
    s.id ASC
{{ if .Query.Limit }}
LIMIT {{ .Arg .Query.Limit }}
{{ end }}
