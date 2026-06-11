UPDATE {{ .Ident "secret_secure_value_counter" }} 
    SET {{ .Ident "counter" }} = {{ .Arg .Counter }}
WHERE
    {{ .Ident "namespace"}} = {{ .Arg .Namespace }} AND
    {{ .Ident "name"}} = {{ .Arg .Name }} AND
    {{ .Ident "counter"}} = {{ .Arg .CurrentCounter }};