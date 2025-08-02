UPDATE "grafana"."user" 
SET login = 'updated-user', 
    email = 'updated@example.com', 
    name = 'Updated User', 
    is_admin = FALSE, 
    is_disabled = FALSE, 
    email_verified = TRUE, 
    is_provisioned = FALSE, 
    updated = '2023-01-15 14:30:00 +0000 UTC',
    version = version + 1
WHERE uid = 'user-1'
  AND org_id = 1
