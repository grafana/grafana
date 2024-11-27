UPDATE `resource`
    SET
        `guid`   = '',
        `value`  = '[]',
        `action` = 'UNKNOWN'  
    WHERE 1 = 1
        AND `group`     = ''
        AND `resource`  = ''
        AND `namespace` = ''
        AND `name`      = ''
;
