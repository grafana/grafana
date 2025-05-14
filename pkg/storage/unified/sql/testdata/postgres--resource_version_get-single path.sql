SELECT
        "resource_version",
        (EXTRACT(EPOCH FROM statement_timestamp()) * 1000000)::BIGINT
    FROM "resource_version"
    WHERE 1 = 1
        AND "group"    = 'group'
        AND "resource" = 'resource'
    FOR UPDATE
;
