SELECT
    `resource_version`,
    `namespace`,
    `name`,
    `folder`,
    `value`
    FROM `resource`
    WHERE 1 = 1
            AND `namespace` = 'ns'
    ORDER BY `namespace` ASC, `name` ASC
;
