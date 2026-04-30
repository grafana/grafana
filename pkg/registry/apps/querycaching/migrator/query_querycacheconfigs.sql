SELECT
    c.id,
    c.data_source_uid,
    c.enabled,
    c.ttl_ms,
    c.ttl_resources_ms,
    c.use_default_ttl,
    {{ if eq .DialectName "mysql" }}UNIX_TIMESTAMP(c.created){{ else if eq .DialectName "postgres" }}EXTRACT(EPOCH FROM c.created)::bigint{{ else }}CAST(strftime('%s', c.created) AS INTEGER){{ end }} AS created_epoch,
    d.type AS plugin_id,
    d.org_id
FROM
    {{ .Ident .CacheTable }} AS c
INNER JOIN
    {{ .Ident .DataSourceTable }} AS d ON c.data_source_uid = d.uid
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
