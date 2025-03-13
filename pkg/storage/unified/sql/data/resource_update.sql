UPDATE {{ .Ident "resource" }}
    SET
        {{ .Ident "guid" }}   = {{ .Arg .GUID }},
        {{ .Ident "value" }}  = {{ .Arg .WriteEvent.Value }},
        {{ .Ident "folder" }}  = {{ .Arg .Folder }},
        {{ .Ident "action" }} = {{ .Arg .WriteEvent.Type }},
        {{ .Ident "resource_version" }} = {{ .Arg .ResourceVersion }}
    WHERE 1 = 1
        AND {{ .Ident "group" }}     = {{ .Arg .WriteEvent.Key.Group }}
        AND {{ .Ident "resource" }}  = {{ .Arg .WriteEvent.Key.Resource }}
        AND {{ .Ident "namespace" }} = {{ .Arg .WriteEvent.Key.Namespace }}
        AND {{ .Ident "name" }}      = {{ .Arg .WriteEvent.Key.Name }}
;
