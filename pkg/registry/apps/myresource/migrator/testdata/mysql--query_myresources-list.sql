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
    `grafana`.`my_resource` as m
WHERE
    m.org_id = 1
ORDER BY
    m.id ASC
