INSERT INTO embedding_collections (
    "group_name",
    "resource",
    "partition_key",
    "is_external"
)
VALUES (
    'ext.example.com',
    'my-things',
    'my_things_external',
    TRUE
)
ON CONFLICT DO NOTHING
;
