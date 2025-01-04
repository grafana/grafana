 SELECT
    MIN(`rv`) AS rv,
    CAST(FLOOR(UNIX_TIMESTAMP(NOW(6)) * 1000000) AS SIGNED) AS current_epoch
    FROM (
        SELECT MAX(`resource_version`) AS rv
        FROM `resource_history`
        WHERE `group`     = 'group'
        AND `resource`  = 'resource'
        UNION ALL
        SELECT MIN(`resource_version`) AS rv
        FROM `resource_lock`
        WHERE `group`     = 'group'
        AND `resource`  = 'resource'
        UNION ALL
        SELECT CAST(FLOOR(UNIX_TIMESTAMP(NOW(6)) * 1000000) AS SIGNED) AS rv
    ) AS t
    WHERE rv IS NOT NULL
;
