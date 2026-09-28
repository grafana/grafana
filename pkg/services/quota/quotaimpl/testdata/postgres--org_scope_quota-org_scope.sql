SELECT target, "limit"
FROM "test_schema"."quota"
WHERE user_id = 0
  AND org_id = 8
