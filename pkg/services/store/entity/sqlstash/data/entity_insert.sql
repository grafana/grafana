INSERT INTO

    {{/* Determine which table to insert into */}}
    {{ if .TableEntity }} {{ .Ident "entity" }}
    {{ else }}            {{ .Ident "entity_history" }}
    {{ end }}

    {{/* Explicitly specify fields that will be set */}}
    (
        {{ .Ident "guid" }},
        {{ .Ident "resource_version" }},

        {{ .Ident "key" }},

        {{ .Ident "group" }},
        {{ .Ident "group_version" }},
        {{ .Ident "resource" }},
        {{ .Ident "namespace" }},
        {{ .Ident "name" }},

        {{ .Ident "folder" }},

        {{ .Ident "meta" }},
        {{ .Ident "body" }},
        {{ .Ident "status" }},

        {{ .Ident "size" }},
        {{ .Ident "etag" }},

        {{ .Ident "created_at" }},
        {{ .Ident "created_by" }},
        {{ .Ident "updated_at" }},
        {{ .Ident "updated_by" }},

        {{ .Ident "origin" }},
        {{ .Ident "origin_key" }},
        {{ .Ident "origin_ts" }},

        {{ .Ident "title" }},
        {{ .Ident "slug" }},
        {{ .Ident "description" }},

        {{ .Ident "message" }},
        {{ .Ident "labels" }},
        {{ .Ident "fields" }},
        {{ .Ident "errors" }},

        {{ .Ident "action" }}
    )

    {{/* Provide the values */}}
    VALUES (
        {{ .Arg .Entity.Guid }},
        {{ .Arg .Entity.ResourceVersion }},

        {{ .Arg .Entity.Key }},

        {{ .Arg .Entity.Group }},
        {{ .Arg .Entity.GroupVersion }},
        {{ .Arg .Entity.Resource }},
        {{ .Arg .Entity.Namespace }},
        {{ .Arg .Entity.Name }},

        {{ .Arg .Entity.Folder }},

        {{ .Arg .Entity.Meta }},
        {{ .Arg .Entity.Body }},
        {{ .Arg .Entity.Status }},

        {{ .Arg .Entity.Size }},
        {{ .Arg .Entity.ETag }},

        {{ .Arg .Entity.CreatedAt }},
        {{ .Arg .Entity.CreatedBy }},
        {{ .Arg .Entity.UpdatedAt }},
        {{ .Arg .Entity.UpdatedBy }},

        {{ .Arg .Entity.Origin.Source }},
        {{ .Arg .Entity.Origin.Key }},
        {{ .Arg .Entity.Origin.Time }},

        {{ .Arg .Entity.Title }},
        {{ .Arg .Entity.Slug }},
        {{ .Arg .Entity.Description }},

        {{ .Arg .Entity.Message }},
        {{ .Arg .Entity.Labels }},
        {{ .Arg .Entity.Fields }},
        {{ .Arg .Entity.Errors }},

        {{ .Arg .Entity.Action }}
    )
;
