SELECT
    p.id,
    p.org_id,
    p.uid,
    p.name,
    p.interval,
    p.created_at,
    p.updated_at,
    pi.type as item_type,
    pi.value as item_value
FROM
    "grafana"."playlist" as p
    LEFT OUTER JOIN "grafana"."playlist_item" as pi ON p.id = pi.playlist_id
WHERE
    p.org_id = 1
ORDER BY
    p.id ASC,
    pi."order" ASC
