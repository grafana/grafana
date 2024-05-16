INSERT INTO {{ .Ident "entity_labels" }}
  (
    {{ .Ident "guid" }},
    {{ .Ident "label" }},
    {{ .Ident "value" }}
  )

  VALUES (
    {{/*
      When we enter the "range" loop the "." will be changed, so we need to
      store the current ".GUID" in a variable to be able to use its value
    */}}
    {{ $guid := .GUID }}

    {{ $addComma := false }}
    {{ range $name, $value := .Labels }}
      {{ if $addComma }}
        ,
      {{ end }}
      {{ $addComma = true }}

      (
        {{ .Arg $guid }},
        {{ .Arg $name }},
        {{ .Arg $value }}
      )
    {{ end }}
  )
;
