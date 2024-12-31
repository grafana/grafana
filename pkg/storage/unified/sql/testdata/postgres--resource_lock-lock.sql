INSERT INTO "resource_lock"
    (
        "group",
        "resource",
        "namespace",
        "name",
        "resource_version"
    )
    VALUES (
        'gp',
        'rs',
        'ns',
        'nm',
        (EXTRACT(EPOCH FROM statement_timestamp()) * 1000000)::BIGINT
    )
;
