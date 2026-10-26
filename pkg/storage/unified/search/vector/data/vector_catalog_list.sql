SELECT
    {{ .Ident "group_name"    | .Into .Response.GroupName }},
    {{ .Ident "resource"      | .Into .Response.Resource }},
    {{ .Ident "partition_key" | .Into .Response.PartitionKey }},
    {{ .Ident "is_external"   | .Into .Response.IsExternal }},
    {{ .Ident "scope"         | .Into .Response.Scope }}
    FROM embedding_collections
;
