SELECT
    c.id,
    c.data_source_uid,
    c.enabled,
    c.ttl_ms,
    c.ttl_resources_ms,
    c.use_default_ttl,
    c.created,
    c.updated,
    d.type AS plugin_id,
    d.org_id
FROM
    {{ .Ident .CacheTable }} AS c
INNER JOIN
    {{ .Ident .DataSourceTable }} AS d ON c.data_source_id = d.id
WHERE
    d.org_id = {{ .Arg .Query.OrgID }}
    {{ if .Query.LastID }}
    AND c.id > {{ .Arg .Query.LastID }}
    {{ end }}
ORDER BY
    c.id ASC
{{ if .Query.Limit }}
LIMIT {{ .Arg .Query.Limit }}
{{ end }}
