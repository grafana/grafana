INSERT INTO {{ .Ident "secret_secure_value_counter" }} 
    ({{ .Ident "namespace"}}, {{ .Ident "name"}}, {{ .Ident "counter"}})
VALUES 
    ({{ .Arg .Namespace}}, {{ .Arg .Name}}, {{ .Arg .Counter}});