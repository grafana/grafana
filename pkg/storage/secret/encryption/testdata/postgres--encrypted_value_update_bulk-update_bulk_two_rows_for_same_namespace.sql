UPDATE
  "secret_encrypted_value"
SET
  "encrypted_data" = (
    CASE
    WHEN "namespace" = 'ns' AND "name" = 'value_1' AND "version" = 1 THEN '[115 101 99 114 101 116 95 49]'
    WHEN "namespace" = 'ns' AND "name" = 'value_2' AND "version" = 2 THEN '[115 101 99 114 101 116 95 50]'
    ELSE "encrypted_data"
    END
  ),
  "data_key_id" = (
    CASE
    WHEN "namespace" = 'ns' AND "name" = 'value_1' AND "version" = 1 THEN 'key_1'
    WHEN "namespace" = 'ns' AND "name" = 'value_2' AND "version" = 2 THEN 'key_2'
    ELSE "data_key_id"
    END
  ),
  "updated" = (
    CASE
    WHEN "namespace" = 'ns' AND "name" = 'value_1' AND "version" = 1 THEN 5679
    WHEN "namespace" = 'ns' AND "name" = 'value_2' AND "version" = 2 THEN 5680
    ELSE "updated"
    END
  )
WHERE "namespace" = 'ns' AND (
  ("name" = 'value_1' AND "version" = 1)
  OR ("name" = 'value_2' AND "version" = 2)
);
