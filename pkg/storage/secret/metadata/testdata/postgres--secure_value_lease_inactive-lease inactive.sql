UPDATE
  "secret_secure_value"
SET
  "lease_token" = 'token',
  "lease_created" = 10
WHERE "guid" IN (
  SELECT "guid" FROM (
    SELECT
      "guid",
      ROW_NUMBER() OVER (ORDER BY "created" ASC) AS rn
    FROM "secret_secure_value"
    WHERE
      "active" = FALSE AND
      10 - "updated" > 300 AND
      10 - "lease_created" > POWER(30, "gc_attempts")
  ) AS sub 
  WHERE rn <= 10
)
;
