SELECT
    `guid`,
    `namespace`,
    `group`,
    `resource`,
    `name`,
    `folder`,
    `resource_version`,
    `value`
    FROM `resource`
    WHERE 1 = 1
        AND `namespace` = 'nn'
        AND `group`     = 'gg'
        AND `resource`  = 'rr'
        AND `name`      = 'name'
;
