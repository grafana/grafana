SELECT
    MIN(`resource_version`),
    `group`,
    `resource`
    FROM (
        SELECT MAX(`resource_version`) AS "resource_version", `group`, `resource`
        FROM `resource_history`
        GROUP BY `group`, `resource`
        UNION ALL
        SELECT MIN(`resource_version`) - 1 AS "resource_version", `group`, `resource`
        FROM `resource_lock`
        GROUP BY `group`, `resource`
    ) AS t
    GROUP BY `group`, `resource`
;
