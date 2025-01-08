SELECT
    COUNT(*) AS count
    FROM `resource_lock`
    WHERE 1 = 1
    AND `group`     = 'gp'
    AND `resource`  = 'rs'
;
