UPDATE
  {{ .Ident "secret_secure_value" }}
SET
  {{ .Ident "lease_token" }} = {{ .Arg .LeaseToken }},
  {{ .Ident "lease_created" }} = {{ .Arg .Now }}
WHERE {{ .Ident "guid" }} IN (
  SELECT {{ .Ident "guid" }} FROM (
    SELECT
      {{ .Ident "guid" }},
      ROW_NUMBER() OVER (ORDER BY {{ .Ident "created" }} ASC) AS rn
    FROM {{ .Ident "secret_secure_value" }}
    WHERE
      {{ .Ident "active" }} = FALSE AND
      {{ .Arg .Now }} - {{ .Ident "updated" }} > {{ .Arg .MinAge }} AND
      {{ .Arg .Now }} - {{ .Ident "lease_created" }} > POWER({{ .Arg .LeaseTTL }}, {{ .Ident "gc_attempts" }})
  ) AS sub 
  WHERE rn <= {{ .Arg .MaxBatchSize }}
)
;
