INSERT INTO {{ .Ident "resource_history" }}
    (
        {{ .Ident "guid" }},
        {{ .Ident "group" }},
        {{ .Ident "resource" }},
        {{ .Ident "namespace" }},
        {{ .Ident "name" }},
        {{ .Ident "folder" }},
        {{ .Ident "resource_version" }},
        {{ .Ident "previous_resource_version"}},
        {{ .Ident "generation"}},
        {{ .Ident "value" }},
        {{ .Ident "action" }},
        {{ .Ident "key_path" }}
    )

    VALUES
    {{- $first := true }}
    {{- range $row := .Rows }}
    {{- if $first }}{{ $first = false }}{{ else }},{{ end }}
    (
        {{ $.Arg $row.GUID }},
        {{ $.Arg $row.WriteEvent.Key.Group }},
        {{ $.Arg $row.WriteEvent.Key.Resource }},
        {{ $.Arg $row.WriteEvent.Key.Namespace }},
        {{ $.Arg $row.WriteEvent.Key.Name }},
        {{ $.Arg $row.Folder }},
        {{ $.Arg $row.ResourceVersion }},
        {{ $.Arg $row.WriteEvent.PreviousRV }},
        {{ $.Arg $row.Generation }},
        {{ $.Arg $row.WriteEvent.Value }},
        {{ $.Arg $row.WriteEvent.Type }},
        {{ $.Arg $row.KeyPath }}
    )
    {{- end }}
;
