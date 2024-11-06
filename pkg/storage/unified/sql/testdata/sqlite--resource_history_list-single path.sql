SELECT
    kv."resource_version",
    kv."namespace",
    kv."name",
    kv."value"
FROM (
    SELECT
        "resource_version",
        "namespace",
        "group",
        "resource",
        "name",
        "value",
        "action",
        MAX("resource_version") OVER (
            PARTITION BY "namespace", "group", "resource", "name"
            ORDER BY "resource_version"
            ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
        ) AS max_resource_version
    FROM "resource_history"
    WHERE 1 = 1
        AND "resource_version" <= 0
            AND "namespace" = 'ns'
) AS kv
WHERE kv."resource_version" = kv.max_resource_version
    AND kv."action" != 3
ORDER BY kv."namespace" ASC, kv."name" ASC
LIMIT 10 OFFSET 0
;
