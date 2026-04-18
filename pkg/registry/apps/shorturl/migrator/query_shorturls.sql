SELECT
    s.id,
    s.org_id,
    s.uid,
    s.path,
    s.created_by,
    s.created_at,
    s.last_seen_at
FROM
    {{ .Ident .ShortURLTable }} as s
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