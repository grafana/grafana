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
                AND ("value"->>'metadata.name' != 'test-dashboard' OR "value"->>'metadata.name' IS NULL)
    ORDER BY "namespace" ASC, "name" ASC
;
