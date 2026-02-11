DELETE FROM {{ .Ident "resource" }}
WHERE {{ .Ident "group" }} = {{ .Arg .Group }}
  AND {{ .Ident "resource" }} = {{ .Arg .Resource }}
  AND {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
  AND {{ .Ident "name" }} = {{ .Arg .Name }}
  AND EXISTS (
    SELECT 1
    FROM (
      SELECT {{ .Ident "action" }}
      FROM {{ .Ident "resource_history" }}
      WHERE {{ .Ident "group" }} = {{ .Arg .Group }}
        AND {{ .Ident "resource" }} = {{ .Arg .Resource }}
        AND {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
        AND {{ .Ident "name" }} = {{ .Arg .Name }}
      ORDER BY {{ .Ident "resource_version" }} DESC
      LIMIT 1
    ) h
    WHERE h.{{ .Ident "action" }} = 3
  );
