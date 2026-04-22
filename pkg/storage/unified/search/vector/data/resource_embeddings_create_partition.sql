CREATE TABLE IF NOT EXISTS {{ .NamespacePartitionName }}
    PARTITION OF {{ .Ident "resource_embeddings" }}
    FOR VALUES IN ({{ .NamespaceLiteral }})
    PARTITION BY LIST (model);

CREATE TABLE IF NOT EXISTS {{ .ModelPartitionName }}
    PARTITION OF {{ .NamespacePartitionName }}
    FOR VALUES IN ({{ .ModelLiteral }});
