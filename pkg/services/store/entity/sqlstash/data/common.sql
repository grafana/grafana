{{/*
  This is the list of all the fields in *entity.Entity, in a way that is
  suitable to be imported by other templates that need to select these fields
  from either the "entity" or the "entity_history" tables.

  Example usage:

    SELECT {{ template "common_entity_select_into" . }}
        FROM {{ .Ident "entity" }} AS e

*/}}
{{ define "common_entity_select_into" }}

    e.{{ .Ident "guid"             | .Into .Entity.Guid }},
    e.{{ .Ident "resource_version" | .Into .Entity.ResourceVersion }},

    e.{{ .Ident "key"              | .Into .Entity.Key }},

    e.{{ .Ident "group"            | .Into .Entity.Group }},
    e.{{ .Ident "group_version"    | .Into .Entity.GroupVersion }},
    e.{{ .Ident "resource"         | .Into .Entity.Resource }},
    e.{{ .Ident "namespace"        | .Into .Entity.Namespace }},
    e.{{ .Ident "name"             | .Into .Entity.Name }},

    e.{{ .Ident "folder"           | .Into .Entity.Folder }},

    e.{{ .Ident "meta"             | .Into .Entity.Meta }},
    e.{{ .Ident "body"             | .Into .Entity.Body }},
    e.{{ .Ident "status"           | .Into .Entity.Status }},

    e.{{ .Ident "size"             | .Into .Entity.Size }},
    e.{{ .Ident "etag"             | .Into .Entity.ETag }},

    e.{{ .Ident "created_at"       | .Into .Entity.CreatedAt }},
    e.{{ .Ident "created_by"       | .Into .Entity.CreatedBy }},
    e.{{ .Ident "updated_at"       | .Into .Entity.UpdatedAt }},
    e.{{ .Ident "updated_by"       | .Into .Entity.UpdatedBy }},

    e.{{ .Ident "origin"           | .Into .Entity.Origin.Source }},
    e.{{ .Ident "origin_key"       | .Into .Entity.Origin.Key }},
    e.{{ .Ident "origin_ts"        | .Into .Entity.Origin.Time }},

    e.{{ .Ident "title"            | .Into .Entity.Title }},
    e.{{ .Ident "slug"             | .Into .Entity.Slug }},
    e.{{ .Ident "description"      | .Into .Entity.Description }},

    e.{{ .Ident "message"          | .Into .Entity.Message }},
    e.{{ .Ident "labels"           | .Into .Entity.Labels }},
    e.{{ .Ident "fields"           | .Into .Entity.Fields }},
    e.{{ .Ident "errors"           | .Into .Entity.Errors }},

    e.{{ .Ident "action"           | .Into .Entity.Action }}
{{ end }}

{{/* Build an ORDER BY clause from a []SortBy contained in a .Sort field */}}
{{ define "common_order_by" }}
    {{ $comma := listSep ", " }}
    {{ range .Sort }}
        {{- call $comma -}} {{ $.Ident .Field }} {{ .Direction.String }}
    {{ end }}
{{ end }}
