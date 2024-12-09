SELECT
    `resource_version`,
    `namespace`,
    `group`,
    `resource`,
    `name`,
    `folder`,
    `value`,
    `action`,
    `previous_resource_version`
    FROM `resource_history`
    WHERE 1 = 1
    AND `group` = 'group'
    AND `resource` = 'res'
    AND `resource_version` > 1234
    ORDER BY `resource_version` ASC
;
