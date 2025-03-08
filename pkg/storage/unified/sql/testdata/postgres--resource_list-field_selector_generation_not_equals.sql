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
                AND ("value"->>'metadata.generation' != '1' OR "value"->>'metadata.generation' IS NULL)
    ORDER BY "namespace" ASC, "name" ASC
;
