INSERT INTO embedding_collections (
    {{ .Ident "group_name" }},
    {{ .Ident "resource" }},
    {{ .Ident "partition_key" }},
    {{ .Ident "is_external" }},
    {{ .Ident "scope" }}
)
VALUES (
    {{ .Arg .GroupName }},
    {{ .Arg .Resource }},
    {{ .Arg .PartitionKey }},
    {{ .Arg .IsExternal }},
    {{ .Arg .Scope }}
)
ON CONFLICT ({{ .Ident "group_name" }}, {{ .Ident "resource" }}) DO NOTHING
;
