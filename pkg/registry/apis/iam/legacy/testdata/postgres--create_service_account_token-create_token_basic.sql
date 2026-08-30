INSERT INTO "grafana"."api_key"
  (org_id, name, "key", role, service_account_id, created, updated, expires, is_revoked)
VALUES
  (1,
   'my-token',
   'hashed123',
   'Viewer',
   42,
   '2023-01-01 12:00:00',
   '2023-01-01 12:00:00',
   NULL,
   FALSE)
