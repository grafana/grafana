SELECT
  u.id AS user_id,
  u.uid AS user_uid,
  u.is_admin AS is_grafana_admin,
  u.email AS email,
  u.email_verified AS email_verified,
  u.login AS login,
  u.name AS name,
  u.is_disabled AS is_disabled,
  u.help_flags1 AS help_flags1,
  u.last_seen_at AS last_seen_at,
  org.name AS org_name,
  org_user.role AS org_role,
  org.id AS org_id,
  u.is_service_account AS is_service_account
FROM `test_schema`.`user` AS u
LEFT OUTER JOIN `test_schema`.`org_user` AS org_user
  ON org_user.org_id = 7
  AND org_user.user_id = u.id
LEFT OUTER JOIN `test_schema`.`org` AS org
  ON org.id = org_user.org_id
WHERE u.id = 42
