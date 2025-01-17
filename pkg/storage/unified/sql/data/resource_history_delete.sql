DELETE FROM {{ .Ident "resource_history" }}
 WHERE 1 = 1
   AND {{ .Ident "guid" }} = {{ .Arg .GUID }}
   