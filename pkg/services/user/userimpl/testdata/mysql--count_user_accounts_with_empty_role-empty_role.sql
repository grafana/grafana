SELECT sub.user_accounts_with_no_role
FROM (
  SELECT COUNT(*) AS user_accounts_with_no_role
  FROM `test_schema`.`org_user` AS ou
  LEFT JOIN `test_schema`.`user` AS u ON u.id = ou.user_id
  WHERE ou.role = 'None'
    AND u.is_service_account = FALSE
    AND u.is_disabled = FALSE
) AS sub
