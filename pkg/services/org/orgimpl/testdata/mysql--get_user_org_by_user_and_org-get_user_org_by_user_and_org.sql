SELECT org.name, org_user.role, org_user.org_id
FROM `test_schema`.`org_user` AS org_user
INNER JOIN `test_schema`.`org` AS org ON org_user.org_id = org.id
WHERE org_user.user_id = 42
  AND org_user.org_id = 7
