INSERT INTO {{ .Ident "resource_version" }}
    (
        {{ .Ident "group" }},
        {{ .Ident "resource" }},
        {{ .Ident "resource_version" }}
    )

    VALUES (
        {{ .Arg .Group }},
        {{ .Arg .Resource }},
        {{ .CurrentEpoch }}
    )
;
