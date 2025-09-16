SELECT
    `guid`,
    `resource_version`,
    `namespace`,
    `group`,
    `resource`,
    `name`,
    `folder`,
    `value`
    FROM `resource`
    WHERE 1 = 1
            AND `namespace` = 'ns'
    ORDER BY `namespace` ASC, `name` ASC
;
