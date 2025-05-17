SELECT
    `guid`,
    `namespace`,
    `group`,
    `resource`,
    `name`,
    `folder`,
    `resource_version`,
    `value`
    FROM `resource_history`
    WHERE 1 = 1
        AND `namespace` = 'ns'
        AND `group`     = 'gp'
        AND `resource`  = 'rs'
        AND `name`      = 'nm'
        AND `resource_version` <= 123
    ORDER BY `resource_version` DESC
    LIMIT 1
;
