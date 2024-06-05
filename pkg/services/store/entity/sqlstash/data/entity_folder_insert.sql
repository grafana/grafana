INSERT INTO {{ .Ident "entity_folder" }}
    (
        {{ .Ident "guid" }},
        {{ .Ident "namespace" }},
        {{ .Ident "name" }},
        {{ .Ident "slug_path" }},
        {{ .Ident "tree" }},
        {{ .Ident "depth" }},
        {{ .Ident "lft" }},
        {{ .Ident "rgt" }},
        {{ .Ident "detached" }}
    )

    VALUES
        {{ $comma := listSep ", " }}
        {{ range .Items }}
            {{- call $comma -}} (
                {{ $.Arg .GUID }},
                {{ $.Arg .Namespace }},
                {{ $.Arg .UID }},
                {{ $.Arg .SlugPath }},
                {{ $.Arg .JS }},
                {{ $.Arg .Depth }},
                {{ $.Arg .Left }},
                {{ $.Arg .Right }},
                {{ $.Arg .Detached }}
            )
        {{ end }}
;
