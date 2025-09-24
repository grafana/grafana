WITH to_update AS (
  SELECT guid FROM (
    SELECT 
      guid,
      ROW_NUMBER() OVER (ORDER BY created ASC) AS rn
    FROM {{ .Ident "secret_secure_value" }} 
    WHERE 
      {{ .Ident "active" }} = FALSE AND
      {{ .Arg .Now }} - {{ .Ident "created" }} > {{ .Arg .MinAge }} AND
      {{ .Arg .Now }} - {{ .Ident "lease_created" }} > {{ .Arg .LeaseTTL }}
  ) AS sub
  WHERE rn <= {{ .Arg .MaxBatchSize }}
)
UPDATE
  {{ .Ident "secret_secure_value" }}
SET
  {{ .Ident "lease_token" }} = {{ .Arg .LeaseToken }},
  {{ .Ident "lease_created" }} = {{ .Arg .Now }}
WHERE guid IN (SELECT guid FROM to_update)
;