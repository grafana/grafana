SELECT
  {{ .Ident "guid" }}
FROM
  {{ .Ident "secret_secure_value" }}
WHERE
  {{ .Ident "active" }} = FALSE AND
  {{ .Arg .Now }} - {{ .Ident "updated" }} > {{ .Arg .MinAge }} AND
  {{ .Arg .Now }} - {{ .Ident "lease_created" }} > {{ .Ident "lease_duration" }}
ORDER BY {{ .Ident "created" }} ASC, {{ .Ident "guid" }} ASC
LIMIT {{ .Arg .MaxBatchSize }}
;
