UPDATE {{ .Ident "resource_version" }}
SET
    {{ .Ident "resource_version" }} =  resource_version + 1
WHERE 1 = 1
    AND {{ .Ident "group" }}            = {{ .Arg .Group }}
    AND {{ .Ident "resource" }}         = {{ .Arg .Resource }}
;