UPDATE {{ .Ident "entity" }} SET
        {{ .Ident "resource_version" }} = {{ .Arg .Entity.ResourceVersion }},

        {{ .Ident "group_version" }}    = {{ .Arg .Entity.GroupVersion }},

        {{ .Ident "folder" }}           = {{ .Arg .Entity.Folder }},

        {{ .Ident "meta" }}             = {{ .Arg .Entity.Meta }},
        {{ .Ident "body" }}             = {{ .Arg .Entity.Body }},
        {{ .Ident "status" }}           = {{ .Arg .Entity.Status }},

        {{ .Ident "size" }}             = {{ .Arg .Entity.Size }},
        {{ .Ident "etag" }}             = {{ .Arg .Entity.ETag }},

        {{ .Ident "updated_at" }}       = {{ .Arg .Entity.UpdatedAt }},
        {{ .Ident "updated_by" }}       = {{ .Arg .Entity.UpdatedBy }},

        {{ .Ident "origin" }}           = {{ .Arg .Entity.Origin.Source }},
        {{ .Ident "origin_key" }}       = {{ .Arg .Entity.Origin.Key }},
        {{ .Ident "origin_ts" }}        = {{ .Arg .Entity.Origin.Time }},

        {{ .Ident "title" }}            = {{ .Arg .Entity.Title }},
        {{ .Ident "slug" }}             = {{ .Arg .Entity.Slug }},
        {{ .Ident "description" }}      = {{ .Arg .Entity.Description }},

        {{ .Ident "message" }}          = {{ .Arg .Entity.Message }},
        {{ .Ident "labels" }}           = {{ .Arg .Entity.Labels }},
        {{ .Ident "fields" }}           = {{ .Arg .Entity.Fields }},
        {{ .Ident "errors" }}           = {{ .Arg .Entity.Errors }},

        {{ .Ident "action" }}           = {{ .Arg .Entity.Action }}

    WHERE {{ .Ident "guid" }} = {{ .Arg .Entity.Guid }}
;
