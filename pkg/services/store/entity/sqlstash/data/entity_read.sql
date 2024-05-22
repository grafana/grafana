SELECT
        {{ .Ident "guid"             | .Into .Entity.Guid }},
        {{ .Ident "resource_version" | .Into .Entity.ResourceVersion }},

        {{ .Ident "key"              | .Into .Entity.Key }},

        {{ .Ident "group"            | .Into .Entity.Group }},
        {{ .Ident "group_version"    | .Into .Entity.GroupVersion }},
        {{ .Ident "resource"         | .Into .Entity.Resource }},
        {{ .Ident "namespace"        | .Into .Entity.Namespace }},
        {{ .Ident "name"             | .Into .Entity.Name }},

        {{ .Ident "folder"           | .Into .Entity.Folder }},

        {{ .Ident "meta"             | .Into .Entity.Meta }},
        {{ .Ident "body"             | .Into .Entity.Body }},
        {{ .Ident "status"           | .Into .Entity.Status }},

        {{ .Ident "size"             | .Into .Entity.Size }},
        {{ .Ident "etag"             | .Into .Entity.ETag }},

        {{ .Ident "created_at"       | .Into .Entity.CreatedAt }},
        {{ .Ident "created_by"       | .Into .Entity.CreatedBy }},
        {{ .Ident "updated_at"       | .Into .Entity.UpdatedAt }},
        {{ .Ident "updated_by"       | .Into .Entity.UpdatedBy }},

        {{ .Ident "origin"           | .Into .Entity.Origin.Source }},
        {{ .Ident "origin_key"       | .Into .Entity.Origin.Key }},
        {{ .Ident "origin_ts"        | .Into .Entity.Origin.Time }},

        {{ .Ident "title"            | .Into .Entity.Title }},
        {{ .Ident "slug"             | .Into .Entity.Slug }},
        {{ .Ident "description"      | .Into .Entity.Description }},

        {{ .Ident "message"          | .Into .Entity.Message }},
        {{ .Ident "labels"           | .Into .Entity.Labels }},
        {{ .Ident "fields"           | .Into .Entity.Fields }},
        {{ .Ident "errors"           | .Into .Entity.Errors }},

        {{ .Ident "action"           | .Into .Entity.Action }}

    FROM
        {{ if gt .ResourceVersion 0 }}
            {{ .Ident "entity_history" }}
        {{ else }}
            {{ .Ident "entity" }}
        {{ end }}

    WHERE 1 = 1
        AND {{ .Ident "namespace" }} = {{ .Arg .Key.Namespace }}
        AND {{ .Ident "group" }}     = {{ .Arg .Key.Group }}
        AND {{ .Ident "resource" }}  = {{ .Arg .Key.Resource }}
        AND {{ .Ident "name" }}      = {{ .Arg .Key.Name }}

      {{/*
        Resource versions work like snapshots at the kind level. Thus, a request
        to retrieve a specific resource version should be interpreted as asking
        for a resource as of how it existed at that point in time. This is why we
        request matching entities with at most the provided resource version, and
        return only the one with the highest resource version. In the case of not
        specifying a resource version (i.e. resource version zero), it is
        interpreted as the latest version of the given entity, thus we instead
        query the "entity" table (which holds only the latest version of
        non-deleted entities) and we don't need to specify anything else. The
        "entity" table has a unique constraint on (namespace, group, resource,
        name), so we're guaranteed to have at most one matching row.
      */}}
      {{ if gt .ResourceVersion 0 }}
            AND {{ .Ident "resource_version" }} <= {{ .Arg .ResourceVersion }}

          ORDER BY {{ .Ident "resource_version" }} DESC
          LIMIT 1
      {{ end }}

      {{ if .SelectForUpdate }}
          {{ .SelectFor "UPDATE" }}
      {{ end }}
;
