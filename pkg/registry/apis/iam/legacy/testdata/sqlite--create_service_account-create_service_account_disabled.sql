INSERT INTO "grafana"."user"
  (uid, version, login, email, name, org_id, is_admin, is_disabled, email_verified,
   is_provisioned, is_service_account, salt, rands, created, updated, last_seen_at)
VALUES
  ('abcdef', 0, 'sa-2-disabled-service-account', 'sa-2-disabled-service-account', 'Disabled Service Account',
   2, false, TRUE, false,
   false, true, '', '', '2023-02-01 10:30:00 +0000 UTC', '2023-02-01 10:30:00 +0000 UTC', '2013-02-01 10:30:00 +0000 UTC')
