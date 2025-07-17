INSERT INTO "grafana"."user" 
  (uid, version, login, email, name, org_id, is_admin, is_disabled, email_verified, 
   is_provisioned, is_service_account, salt, rands, created, updated, last_seen_at)
VALUES 
  ('user-1', 0, 'user1', 'user1@example.com', 
   'User One', 1, FALSE, 
   FALSE, TRUE, 
   FALSE, false, 'randomsalt', 'randomrands', 
   '2023-01-01 12:00:00 +0000 UTC', '2023-01-01 12:00:00 +0000 UTC', '2013-01-01 12:00:00 +0000 UTC')
