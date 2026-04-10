DELETE FROM {{ .Ident .TokenTable }}
WHERE name = {{ .Arg .Command.Name }}
  AND org_id = {{ .Arg .Command.OrgID }}
  AND service_account_id = {{ .Arg .Command.ServiceAccountID }}
