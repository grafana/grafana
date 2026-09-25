INSERT INTO {{ .Ident .QuotaTable }} (
  org_id,
  user_id,
  target,
  {{ .Ident "limit" }},
  created,
  updated
)
VALUES (
  {{ .Arg .OrgID }},
  {{ .Arg .UserID }},
  {{ .Arg .Target }},
  {{ .Arg .Limit }},
  {{ .Arg .Created }},
  {{ .Arg .Updated }}
)
