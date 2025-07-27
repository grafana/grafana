UPDATE `grafana`.`user` 
SET login = 'disabled-user', 
    email = 'disabled@example.com', 
    name = 'Disabled User', 
    is_admin = FALSE, 
    is_disabled = TRUE, 
    email_verified = FALSE, 
    is_provisioned = FALSE, 
    updated = '2023-03-10 09:15:00 +0000 UTC',
    version = version + 1
WHERE uid = 'user-3'
  AND org_id = 1
