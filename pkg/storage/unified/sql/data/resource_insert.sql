INSERT INTO {{ .Ident "resource" }}

    (
        {{ .Ident "guid" }},
        {{ .Ident "group" }},
        {{ .Ident "resource" }},
        {{ .Ident "namespace" }},
        {{ .Ident "name" }},

        {{ .Ident "value" }},
        {{ .Ident "action" }}
    )
    VALUES (
        {{ .Arg .GUID }},
        {{ .Arg .WriteEvent.Key.Group }},
        {{ .Arg .WriteEvent.Key.Resource }},
        {{ .Arg .WriteEvent.Key.Namespace }},
        {{ .Arg .WriteEvent.Key.Name }},

        {{ .Arg .WriteEvent.Value }},
        {{ .Arg .WriteEvent.Type }}
    )
;
