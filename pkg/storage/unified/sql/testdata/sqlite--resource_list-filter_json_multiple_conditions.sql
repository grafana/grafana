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
                AND CAST(json_extract("value", '$.metadata.labels.environment') AS TEXT) = 'prod'
                AND (CAST(json_extract("value", '$.spec.title') AS TEXT) != 'Untitled' OR CAST(json_extract("value", '$.spec.title') AS TEXT) IS NULL)
    ORDER BY "namespace" ASC, "name" ASC
;
