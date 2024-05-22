SELECT
        {{ .Ident "guid"   | .Into .FolderInfo.GUID }},
        {{ .Ident "name"   | .Into .FolderInfo.UID }},
        {{ .Ident "folder" | .Into .FolderInfo.ParentUID }},
        {{ .Ident "name"   | .Into .FolderInfo.Name }},
        {{ .Ident "slug"   | .Into .FolderInfo.Slug }}

    FROM {{ .Ident "entity" }}

    WHERE 1 = 1
        AND {{ .Ident "group" }}     = {{ .Arg .Group }}
        AND {{ .Ident "resource" }}  = {{ .Arg .Resource }}
        AND {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
;
