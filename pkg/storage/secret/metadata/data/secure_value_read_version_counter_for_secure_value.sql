SELECT {{ .Ident "namespace" }}, {{ .Ident "name" }}, {{ .Ident "counter" }}
FROM {{ .Ident "secret_secure_value_counter" }} 
WHERE 
    {{ .Ident "namespace" }} = {{ .Arg .Namespace }} AND
    {{ .Ident "name" }} = {{ .Arg .Name }}