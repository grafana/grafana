SELECT
    c.id,
    c.data_source_uid,
    c.enabled,
    c.ttl_ms,
    c.ttl_resources_ms,
    c.use_default_ttl,
    EXTRACT(EPOCH FROM c.created)::bigint AS created_epoch,
    d.type AS plugin_id,
    d.org_id
FROM
    "grafana"."data_source_cache" AS c
INNER JOIN
    "grafana"."data_source" AS d ON c.data_source_uid = d.uid
WHERE
    d.org_id = 1
ORDER BY
    c.id ASC
LIMIT 10
