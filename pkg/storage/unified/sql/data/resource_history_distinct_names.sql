{{/* Select the distinct names for a collection in DB collation order, so the caller can split the resource backfill into byte-bounded name ranges. Index-only over IDX_resource_history_namespace_group_name. */}}
SELECT DISTINCT {{ .Ident "name" | .Into .Response.Name }}
FROM {{ .Ident "resource_history" }}
WHERE {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
  AND {{ .Ident "group" }} = {{ .Arg .Group }}
  AND {{ .Ident "resource" }} = {{ .Arg .Resource }}
ORDER BY {{ .Ident "name" }};
