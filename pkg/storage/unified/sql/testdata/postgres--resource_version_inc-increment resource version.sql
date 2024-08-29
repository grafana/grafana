UPDATE "resource_version"
SET
    "resource_version" = EXTRACT(EPOCH FROM clock_timestamp()) * 1000000::BIGINT
WHERE 1 = 1
    AND "group"    = ''
    AND "resource" = ''
;
