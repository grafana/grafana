SELECT
    `resource_version`,
    `namespace`,
    `name`,
    `folder`,
    `value`
    FROM `resource`
    WHERE 1 = 1
            AND `group`     = 'dashboard.grafana.com'
            AND `resource`  = 'dashboards'
                AND JSON_UNQUOTE(JSON_EXTRACT(`value`, '$.metadata.labels.environment')) = 'prod'
                AND (JSON_UNQUOTE(JSON_EXTRACT(`value`, '$.spec.title')) != 'Untitled' OR JSON_UNQUOTE(JSON_EXTRACT(`value`, '$.spec.title')) IS NULL)
    ORDER BY `namespace` ASC, `name` ASC
;
