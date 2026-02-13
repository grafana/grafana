{{/* Since the prune limit is 20 revisions, the max rows that can be deleted is the number of names * 20. */}}
DELETE FROM {{ .Ident "resource_history" }}
WHERE {{ .Ident "group" }} = {{ .Arg .Group }}
  AND {{ .Ident "resource" }} = {{ .Arg .Resource }}
  AND ({{ .Ident "namespace" }}, {{ .Ident "name" }}) IN (
    {{- range $i, $candidate := .Candidates -}}
    {{- if $i }}, {{ end -}}
    ({{ $.Arg $candidate.Namespace }}, {{ $.Arg $candidate.Name }})
    {{- end -}}
  )
  {{/* Check again that the name is not in the resource table (could have been restored after candidates were queried). */}}
  AND NOT EXISTS (
    SELECT 1 FROM {{ .Ident "resource" }} r
    WHERE r.{{ .Ident "namespace" }} = {{ .Ident "resource_history" }}.{{ .Ident "namespace" }}
      AND r.{{ .Ident "group" }} = {{ .Ident "resource_history" }}.{{ .Ident "group" }}
      AND r.{{ .Ident "resource" }} = {{ .Ident "resource_history" }}.{{ .Ident "resource" }}
      AND r.{{ .Ident "name" }} = {{ .Ident "resource_history" }}.{{ .Ident "name" }}
  );

