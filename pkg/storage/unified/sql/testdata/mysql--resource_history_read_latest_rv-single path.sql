SELECT
    COALESCE(MAX(`resource_version`), 0) AS `resource_version`
    FROM `resource_history`
    WHERE `namespace`   = 'ns'
        AND `group`     = 'gp'
        AND `resource`  = 'rs'
        AND `name`      = 'nm'
    LIMIT 1
;
