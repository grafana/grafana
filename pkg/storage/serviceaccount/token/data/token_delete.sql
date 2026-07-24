DELETE FROM {{ .Ident "serviceaccount_token" }}
WHERE
  {{ .Ident "namespace" }} = {{ .Arg .Namespace }} AND
  {{ .Ident "service_account_name" }} = {{ .Arg .ServiceAccountName }} AND
  {{ .Ident "name" }} = {{ .Arg .Name }}
;
