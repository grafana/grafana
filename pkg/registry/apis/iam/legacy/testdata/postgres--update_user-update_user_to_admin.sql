UPDATE "grafana"."user" 
SET login = 'admin-user', 
    email = 'admin-update@example.com', 
    name = 'Admin Updated User', 
    is_admin = TRUE, 
    is_disabled = FALSE, 
    email_verified = TRUE, 
    is_provisioned = TRUE, 
    updated = '2023-02-15 16:45:00 +0000 UTC',
    version = version + 1
WHERE uid = 'user-2'
  AND org_id = 2
