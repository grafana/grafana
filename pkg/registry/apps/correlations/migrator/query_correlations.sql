SELECT
    c.uid,
    c.org_id,
    c.source_uid,
    c.target_uid,
    c.label,
    c.description,
    c.config,
    c.provisioned,
    c.type
FROM
    {{ .Ident .CorrelationTable }} AS c
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
