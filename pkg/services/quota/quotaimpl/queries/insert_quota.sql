INSERT INTO {{ .Ident .QuotaTable }} (
  org_id,
  user_id,
  target,
  {{ .Ident .LimitColumn }},
  created,
  updated
)
VALUES (
  {{ .Arg .Cmd.OrgID }},
  {{ .Arg .Cmd.UserID }},
  {{ .Arg .Cmd.Target }},
  {{ .Arg .Cmd.Limit }},
  {{ .Arg .Created }},
  {{ .Arg .Updated }}
)
