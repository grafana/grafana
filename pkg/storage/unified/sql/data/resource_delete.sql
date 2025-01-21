DELETE FROM {{ .Ident "resource" }}
  WHERE 1 = 1
    AND {{ .Ident "namespace" }} = {{ .Arg .WriteEvent.Key.Namespace }}
    AND {{ .Ident "group" }}     = {{ .Arg .WriteEvent.Key.Group }}
    AND {{ .Ident "resource" }}  = {{ .Arg .WriteEvent.Key.Resource }}
    {{ if .WriteEvent.Key.Name }}
    AND {{ .Ident "name" }}      = {{ .Arg .WriteEvent.Key.Name }}
    {{ end }}
;
