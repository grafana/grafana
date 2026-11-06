SELECT
    `guid`,
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
    AND `resource_version` IN (1234, 1235, 1240)
;
