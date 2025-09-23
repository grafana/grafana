UPDATE {{ .Ident "resource" }}
    SET {{ .Ident "resource_version" }} = {{ .Arg .ResourceVersion }}
    WHERE  {{ .Ident "guid" }} = {{ .Arg .GUID }}
;
