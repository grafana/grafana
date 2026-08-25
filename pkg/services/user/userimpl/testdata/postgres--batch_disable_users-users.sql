UPDATE "test_schema"."user"
SET is_disabled = TRUE
WHERE id IN (11, 12, 13)
  AND is_service_account = FALSE
