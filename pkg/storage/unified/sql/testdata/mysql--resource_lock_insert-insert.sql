INSERT INTO `resource_lock`
    (
        `group`,
        `resource`,
        `namespace`,
        `name`,
        `resource_version`
    )
    SELECT 'gp', 'rs', 'ns', 'nm', MAX(rv)
    FROM (
        SELECT CAST(FLOOR(UNIX_TIMESTAMP(NOW(6)) * 1000000) AS SIGNED) AS rv
        UNION ALL
        SELECT MAX(`resource_version`) + 1 AS rv
        FROM `resource_history`
        WHERE `group`     = 'gp'
        AND `resource`  = 'rs'
        UNION ALL
        SELECT MIN(`resource_version`) + 1 AS rv
        FROM `resource_lock`
        WHERE `group`     = 'gp'
        AND `resource`  = 'rs'
    ) AS t
;
