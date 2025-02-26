UPDATE `resource`
    SET
        `guid`   = '',
        `value`  = '[]',
        `folder`  = 'fldr',
        `action` = 'UNKNOWN',
        `resource_version` = 0
    WHERE 1 = 1
        AND `group`     = 'gg'
        AND `resource`  = 'rr'
        AND `namespace` = 'nn'
        AND `name`      = 'name'
;
