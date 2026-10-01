SELECT sub.user_accounts_with_no_role
FROM (
  SELECT COUNT(*) AS user_accounts_with_no_role
  FROM {{ .Ident .OrgUserTable }} AS ou
  LEFT JOIN {{ .Ident .UserTable }} AS u ON u.id = ou.user_id
  WHERE ou.role = {{ .Arg .Role }}
    AND u.is_service_account = FALSE
    AND u.is_disabled = FALSE
) AS sub
