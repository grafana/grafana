UPDATE
  {{ .Ident "secret_secure_value" }}
SET
  {{ .Ident "lease_token" }} = {{ .Arg .LeaseToken }},
  {{ .Ident "lease_created" }} = {{ .Arg .Now }}
WHERE 
  {{ .Ident "guid" }} IN (SELECT {{ .Ident "guid"}} 
                          FROM {{ .Ident "secret_secure_value" }} 
                          WHERE 
                            {{ .Ident "active" }} = FALSE AND
                            {{ .Arg .Now }} - {{ .Ident "created" }} > {{ .Arg .MinAge }} AND
                            {{ .Arg .Now }} - {{ .Ident "lease_created" }} > {{ .Arg .LeaseTTL }}
                          LIMIT {{ .Arg .MaxBatchSize }})
;