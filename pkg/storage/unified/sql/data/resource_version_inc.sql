UPDATE {{ .Ident "resource_version" }}
SET
    {{ .Ident "resource_version" }} = {{ .CurrentEpoch }}
WHERE 1 = 1
    AND {{ .Ident "group" }}    = {{ .Arg .Group }}
    AND {{ .Ident "resource" }} = {{ .Arg .Resource }}
;
