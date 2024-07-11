INSERT INTO {{ .Ident "kind_version" }}
    (
        {{ .Ident "group" }},
        {{ .Ident "resource" }},
        {{ .Ident "resource_version" }},
        {{ .Ident "created_at" }},
        {{ .Ident "updated_at" }}
    )

    VALUES (
        {{ .Arg .Group }},
        {{ .Arg .Resource }},
        1,
        {{ .Arg .CreatedAt }},
        {{ .Arg .UpdatedAt }}
    )
;
