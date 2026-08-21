UPDATE `test_schema`.`user`
SET
email = 'alice@example.com',
name = 'Alice',
login = 'alice',
password = 'hashed-password',
email_verified = TRUE,
theme = 'dark',
is_disabled = FALSE,
is_admin = TRUE,
org_id = 7,
is_provisioned = FALSE,
updated = '2026-01-02 03:04:05'
WHERE id = 42
  AND is_service_account = FALSE
