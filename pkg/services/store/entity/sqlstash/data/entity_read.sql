SELECT {{ template "common_entity_select_into" . }}

    FROM
        {{ if gt .ResourceVersion 0 }}
            {{ .Ident "entity_history" }} AS e
        {{ else }}
            {{ .Ident "entity" }} AS e
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
          {{ .SelectFor "UPDATE NOWAIT" }}
      {{ end }}
;
