SELECT target, "limit"
FROM "test_schema"."quota"
WHERE user_id = 42
  AND org_id = 0
