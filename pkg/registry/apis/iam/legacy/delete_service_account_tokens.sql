DELETE FROM {{ .Ident .TokenTable }}
WHERE org_id = {{ .Arg .Command.OrgID }}
  AND service_account_id = {{ .Arg .Command.ServiceAccountID }}
