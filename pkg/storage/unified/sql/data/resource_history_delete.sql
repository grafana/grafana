DELETE FROM {{ .Ident "resource_history" }}
 WHERE {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
  {{ if .GUID }}
   AND {{ .Ident "guid" }} = {{ .Arg .GUID }}
  {{ end }}
  {{ if .Group }}
   AND {{ .Ident "group" }} = {{ .Arg .Group }}
  {{ end }}
  {{ if .Resource }}
   AND {{ .Ident "resource" }} = {{ .Arg .Resource }}
  {{ end }}
   