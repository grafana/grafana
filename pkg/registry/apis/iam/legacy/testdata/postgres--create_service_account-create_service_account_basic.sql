INSERT INTO "grafana"."user"
  (uid, version, login, email, name, org_id, is_admin, is_disabled, email_verified,
   is_provisioned, is_service_account, salt, rands, created, updated, last_seen_at)
VALUES
  ('abcdef', 0, 'sa-1-service-account-1', 'sa-1-service-account-1', 'Service Account 1',
   1, false, FALSE, false,
   false, true, '', '', '2023-01-01 12:00:00 +0000 UTC', '2023-01-01 12:00:00 +0000 UTC', '2013-01-01 12:00:00 +0000 UTC')
