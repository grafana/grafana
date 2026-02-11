SELECT
    m.id,
    m.org_id,
    m.uid,
    m.title,
    m.content,
    m.ready,
    m.created_by,
    m.created_at,
    m.updated_at
FROM
    {{ .Ident .MyResourceTable }} as m
WHERE
    m.org_id = {{ .Arg .Query.OrgID }}
ORDER BY
    m.id ASC