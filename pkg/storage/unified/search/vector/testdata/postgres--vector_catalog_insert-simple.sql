INSERT INTO embedding_collections (
    "group_name",
    "resource",
    "partition_key",
    "is_external",
    "scope"
)
VALUES (
    'ext.example.com',
    'my-things',
    'my_things_external',
    TRUE,
    'tenant'
)
ON CONFLICT ("group_name", "resource") DO NOTHING
;
