SELECT
    s.id,
    s.org_id,
    s.uid,
    s.path,
    s.created_by,
    s.created_at,
    s.last_seen_at
FROM
    {{ .Ident .ShortURLTable }} as s{{ if eq .DialectName "mysql" }} FORCE INDEX (IDX_short_url_org_id_id){{ end }}
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