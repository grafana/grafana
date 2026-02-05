DELETE FROM {{ .Ident "resource_history" }}
WHERE {{ .Ident "guid" }} IN (
  SELECT {{ .Ident "guid" }}
  FROM (
  SELECT
    {{ .Ident "guid" }},
    ROW_NUMBER() OVER (
      PARTITION BY {{ if ne .Key.Namespace "" }}{{ .Ident "namespace" }}
        , {{ end }}{{ .Ident "group" }}
        , {{ .Ident "resource" }}
        , {{ .Ident "name" }}
        {{ if .PartitionByGeneration }}
        , {{ .Ident "generation" }}
        {{ end }}
      ORDER BY {{ .Ident "resource_version" }} DESC
    ) AS {{ .Ident "rn" }}
  FROM {{ .Ident "resource_history" }}
  WHERE {{ if ne .Key.Namespace "" }}{{ .Ident "namespace" }} = {{ .Arg .Key.Namespace }}
    AND {{ end }}{{ .Ident "group" }} = {{ .Arg .Key.Group }}
    AND {{ .Ident "resource" }} = {{ .Arg .Key.Resource }}
    AND {{ .Ident "name" }} = {{ .Arg .Key.Name }}
    {{ if .PartitionByGeneration }}
    AND {{ .Ident "generation" }} > 0
    {{ end }}
  ) AS {{ .Ident "ranked" }}
  WHERE {{ .Ident "rn" }} > {{ .Arg .HistoryLimit }}
);
