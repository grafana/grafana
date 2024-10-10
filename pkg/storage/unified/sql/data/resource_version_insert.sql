INSERT INTO {{ .Ident "resource_version" }}
    (
        {{ .Ident "shard" }},
        {{ .Ident "group" }},
        {{ .Ident "resource" }},
        {{ .Ident "resource_version" }}
    )

    VALUES (
        {{ .Arg .Shard }},
        {{ .Arg .Group }},
        {{ .Arg .Resource }},
        {{ .CurrentEpoch }}
    )
;
