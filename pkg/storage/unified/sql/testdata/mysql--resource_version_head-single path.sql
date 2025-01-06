 SELECT
    MIN(`rv`) AS rv
    FROM (
        SELECT MAX(`resource_version`) AS rv
        FROM `resource_history`
        WHERE `group`     = 'group'
        AND `resource`  = 'resource'
        UNION ALL
        SELECT MIN(`resource_version`) - 1 AS rv
        FROM `resource_lock`
        WHERE `group`     = 'group'
        AND `resource`  = 'resource'
    ) AS t
    WHERE rv IS NOT NULL
;
