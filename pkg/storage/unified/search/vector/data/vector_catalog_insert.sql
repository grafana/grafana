INSERT INTO embedding_collections (
    {{ .Ident "group_name" }},
    {{ .Ident "resource" }},
    {{ .Ident "partition_key" }},
    {{ .Ident "is_external" }}
)
VALUES (
    {{ .Arg .GroupName }},
    {{ .Arg .Resource }},
    {{ .Arg .PartitionKey }},
    {{ .Arg .IsExternal }}
)
ON CONFLICT DO NOTHING
;
