SELECT
    kv."resource_version",
    kv."namespace",
    kv."name",
    kv."folder",
    kv."value"
    FROM "resource_history" as kv 
    INNER JOIN  (
        SELECT "namespace", "group", "resource", "name",  max("resource_version") AS "resource_version"
        FROM "resource_history" AS mkv
        WHERE 1 = 1
            AND "resource_version" <=  12345
                AND "group"     = 'dashboard.grafana.com'
                AND "resource"  = 'dashboards'
        GROUP BY mkv."namespace", mkv."group", mkv."resource", mkv."name" 
    ) AS maxkv
    ON
        maxkv."resource_version"  = kv."resource_version"
        AND maxkv."namespace"     = kv."namespace"
        AND maxkv."group"         = kv."group"
        AND maxkv."resource"      = kv."resource"
        AND maxkv."name"          = kv."name"
    WHERE kv."action"  != 3 
        AND kv."group"     = 'dashboard.grafana.com'
        AND kv."resource"  = 'dashboards'
            AND (kv."value"->>'metadata.name' != 'test-dashboard' OR kv."value"->>'metadata.name' IS NULL)
    ORDER BY kv."namespace" ASC, kv."name" ASC
;
