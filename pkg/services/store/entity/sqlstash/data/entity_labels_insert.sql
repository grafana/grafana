INSERT INTO {{ .Ident "entity_labels" }}
    (
        {{ .Ident "guid" }},
        {{ .Ident "label" }},
        {{ .Ident "value" }}
    )

    VALUES
        {{ $comma := listSep ", " }}
        {{ range $name, $value := .Labels }}
            {{- call $comma -}} (
                {{ $.Arg $.GUID }},
                {{ $.Arg $name }},
                {{ $.Arg $value }}
            )
        {{ end }}
;
