SELECT
    s.id,
    s.org_id,
    s.uid,
    s.path,
    s.created_by,
    s.created_at,
    s.last_seen_at
FROM
    "grafana"."short_url" as s
WHERE
    s.org_id = 1
    AND s.id > 5
ORDER BY
    s.id ASC
LIMIT 10
