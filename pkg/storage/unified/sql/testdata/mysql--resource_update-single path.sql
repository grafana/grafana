UPDATE `resource`
    SET
        `guid`   = '',
        `value`  = '[]',
        `folder`  = 'fldr',
        `action` = 'UNKNOWN'  
    WHERE 1 = 1
        AND `group`     = 'gg'
        AND `resource`  = 'rr'
        AND `namespace` = 'nn'
        AND `name`      = 'name'
;
