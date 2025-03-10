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
                AND "value"->>'metadata.name' = 'dashboard-1'
                AND ("value"->>'spec.title' != 'Untitled' OR "value"->>'spec.title' IS NULL)
    ORDER BY "namespace" ASC, "name" ASC
;
