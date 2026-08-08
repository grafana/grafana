SELECT
    c.uid,
    c.org_id,
    c.source_uid,
    c.target_uid,
    c.label,
    c.description,
    c.config,
    c.provisioned,
    c.type,
    dss.type as source_type,
    dst.type as target_type
FROM
    {{ .Ident .CorrelationTable }} AS c
JOIN
    {{ .Ident .DataSourceTable }} AS dss ON c.source_uid = dss.uid AND dss.org_id = c.org_id
LEFT OUTER JOIN
    {{ .Ident .DataSourceTable }} AS dst ON c.target_uid = dst.uid AND dst.org_id = c.org_id
WHERE
    c.org_id = {{ .Arg .Query.OrgID }}
    {{ if .Query.LastUID }}
    AND c.uid > {{ .Arg .Query.LastUID }}
    {{ end }}
ORDER BY
    c.uid ASC
{{ if .Query.Limit }}
LIMIT {{ .Arg .Query.Limit }}
{{ end }}
