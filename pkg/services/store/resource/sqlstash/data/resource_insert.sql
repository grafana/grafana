INSERT INTO "resource"
    {{/* Explicitly specify fields that will be set */}}
    (
        {{ .Ident "event" }},
        {{ .Ident "group" }},
        {{ .Ident "api_version" }},
        {{ .Ident "namespace" }},
        {{ .Ident "resource" }},
        {{ .Ident "name" }},
        {{ .Ident "operation" }},
        {{ .Ident "message" }},
        {{ .Ident "value" }},
        {{ .Ident "hash" }},
        {{ .Ident "blob" }},
    )

    {{/* Provide the values */}}
    VALUES (
        {{ .Arg .Event.ID }},
        {{ .Arg .Event.Group }},
        {{ .Arg .Event.ApiVersion }},
        {{ .Arg .Event.Namespace }},
        {{ .Arg .Event.Resource }},
        {{ .Arg .Event.Name }},
        {{ .Arg .Event.Operation }},
        {{ .Arg .Event.Message }},
        {{ .Arg .Event.Value }},
        {{ .Arg .Event.Hash }},
        {{ .Arg .Event.Blob }},
    )
;
