SELECT COUNT(*) AS count
FROM (
  SELECT user_id
  FROM "test_schema"."org_user"
  WHERE org_id = 7
    AND user_id IN (
      SELECT id
      FROM "test_schema"."user"
      WHERE is_service_account = FALSE
    )
) AS subq
