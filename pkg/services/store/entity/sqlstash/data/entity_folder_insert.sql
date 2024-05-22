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
        {{ $this := . }}
        {{ $addComma := false }}
        {{ range .Items }}
            {{ if $addComma }}
                ,
            {{ end }}
            {{ $addComma = true }}

            (
                {{ $this.Arg .GUID }},
                {{ $this.Arg .Namespace }},
                {{ $this.Arg .UID }},
                {{ $this.Arg .SlugPath }},
                {{ $this.Arg .JS }},
                {{ $this.Arg .Depth }},
                {{ $this.Arg .Left }},
                {{ $this.Arg .Right }},
                {{ $this.Arg .Detached }}
            )
        {{ end }}
;
