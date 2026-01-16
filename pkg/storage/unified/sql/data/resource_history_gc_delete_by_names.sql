-- Since the prune limit is 20 revisions, the max rows that can be deleted is the number of names * 20.
DELETE FROM {{ .Ident "resource_history" }} h
WHERE h.{{ .Ident "group" }} = {{ .Arg .Group }}
  AND h.{{ .Ident "resource" }} = {{ .Arg .Resource }}
  AND h.{{ .Ident "name" }} IN (
    {{- range $i, $name := .Names -}}
    {{- if $i }}, {{ end -}}
    {{ $.Arg $name }}
    {{- end -}}
  )
  -- Check again that the name is not in the resource table (could have been restored after candidates were queried)
  AND NOT EXISTS (
    SELECT 1 FROM {{ .Ident "resource" }} r
    WHERE r.{{ .Ident "namespace" }} = h.{{ .Ident "namespace" }}
      AND r.{{ .Ident "group" }} = h.{{ .Ident "group" }}
      AND r.{{ .Ident "resource" }} = h.{{ .Ident "resource" }}
      AND r.{{ .Ident "name" }} = h.{{ .Ident "name" }}
  );

