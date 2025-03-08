SELECT
    "resource_version",
    "namespace",
    "name",
    "folder",
    "value"
    FROM "resource"
    WHERE 1 = 1
            AND "group"     = 'dashboard.grafana.com'
            AND "resource"  = 'dashboards'
                AND CAST(json_extract("value", '$.metadata.name') AS TEXT) = 'test-dashboard'
    ORDER BY "namespace" ASC, "name" ASC
;
