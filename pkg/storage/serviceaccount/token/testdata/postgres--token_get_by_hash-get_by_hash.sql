SELECT
  "id",
  "namespace",
  "name",
  "key",
  "created",
  "updated",
  "last_used_at",
  "service_account_name",
  "is_revoked",
  "expires"
FROM "serviceaccount_token"
WHERE "key" = 'hashed-key'
;
