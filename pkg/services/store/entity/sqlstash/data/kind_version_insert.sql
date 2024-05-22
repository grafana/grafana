INSERT INTO {{ .Ident "kind_version" }}
    (
        {{ .Ident "group" }},
        {{ .Ident "resource" }},
        {{ .Ident "resource_version" }}
    )

    VALUES (
        {{ .Arg .Group }},
        {{ .Arg .Resource }},
        1
    )
;
