UPDATE {{ .Ident "resource_version" }}
SET
    {{ .Ident "resource_version" }} = {{.Greatest  .CurrentEpoch (print (.Ident "resource_version")  " + 1") }}
WHERE 1 = 1
    AND {{ .Ident "group" }}    = {{ .Arg .Group }}
    AND {{ .Ident "resource" }} = {{ .Arg .Resource }}
;
