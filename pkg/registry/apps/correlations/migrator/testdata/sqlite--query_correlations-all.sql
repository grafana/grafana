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
    "grafana"."correlation" AS c
WHERE
    c.org_id = 1
    AND c.uid > 'abc123'
ORDER BY
    c.uid ASC
LIMIT 10
