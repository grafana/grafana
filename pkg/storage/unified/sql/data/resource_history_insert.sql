INSERT INTO {{ .Ident "resource_history" }}
    (
        {{ .Ident "guid" }},
        {{ .Ident "group" }},
        {{ .Ident "resource" }},
        {{ .Ident "namespace" }},
        {{ .Ident "name" }},
        {{ .Ident "folder" }},
        {{ if gt .ResourceVersion 0 }}
        {{ .Ident "resource_version" }},
        {{ end }}
        {{ .Ident "previous_resource_version"}},
        {{ .Ident "value" }},
        {{ .Ident "action" }}
    )

    VALUES (
        {{ .Arg .GUID }},
        {{ .Arg .WriteEvent.Key.Group }},
        {{ .Arg .WriteEvent.Key.Resource }},
        {{ .Arg .WriteEvent.Key.Namespace }},
        {{ .Arg .WriteEvent.Key.Name }},
        {{ .Arg .Folder }},
        {{ if gt .ResourceVersion 0 }}
        {{ .Arg .ResourceVersion }},
        {{ end }}
        {{ .Arg .WriteEvent.PreviousRV }},
        {{ .Arg .WriteEvent.Value }},
        {{ .Arg .WriteEvent.Type }}
    )
;
