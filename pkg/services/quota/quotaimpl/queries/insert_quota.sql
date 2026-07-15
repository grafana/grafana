INSERT INTO {{ .Ident .QuotaTable }} (
  org_id,
  user_id,
  target,
  {{ .Ident "limit" }},
  created,
  updated
)
VALUES (
  {{ .Arg .Quota.OrgId }},
  {{ .Arg .Quota.UserId }},
  {{ .Arg .Quota.Target }},
  {{ .Arg .Quota.Limit }},
  {{ .Arg .Quota.Created }},
  {{ .Arg .Quota.Updated }}
)
