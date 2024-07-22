INSERT INTO {{ .Ident "resource_version" }}
    (
        {{ .Ident "group" }},
        {{ .Ident "resource" }},
        {{ .Ident "rv" }},
    )

    VALUES (
        {{ .Arg .Group }},
        {{ .Arg .Resource }},
        1,
    )
;
