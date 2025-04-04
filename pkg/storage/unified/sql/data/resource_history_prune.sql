DELETE FROM {{ .Ident "resource_history" }}
WHERE {{ .Ident "guid" }} IN (
  SELECT {{ .Ident "guid" }}
  FROM (
  SELECT
    {{ .Ident "guid" }},
    ROW_NUMBER() OVER (
      PARTITION BY {{ .Ident "namespace" }}
        , {{ .Ident "group" }}
        , {{ .Ident "resource" }}
        , {{ .Ident "name" }}
        {{ if .PartitionByGeneration }}
        , {{ .Ident "generation" }}
        {{ end }}
      ORDER BY {{ .Ident "resource_version" }} DESC
    ) AS {{ .Ident "rn" }}
  FROM {{ .Ident "resource_history" }}
  WHERE {{ .Ident "namespace" }} = {{ .Arg .Key.Namespace }}
    AND {{ .Ident "group" }} = {{ .Arg .Key.Group }}
    AND {{ .Ident "resource" }} = {{ .Arg .Key.Resource }}
    AND {{ .Ident "name" }} = {{ .Arg .Key.Name }}
    {{ if .PartitionByGeneration }}
    AND {{ .Ident "generation" }} > 0
    {{ end }}
  ) AS {{ .Ident "ranked" }}
  WHERE {{ .Ident "rn" }} > {{ .Arg .HistoryLimit }}
);
