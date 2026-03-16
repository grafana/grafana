UPDATE
  "secret_encrypted_value"
SET
  "encrypted_data" = (
    CASE
    WHEN "namespace" = 'ns' AND "name" = 'value_1' AND "version" = 1 THEN '[115 101 99 114 101 116 95 49]'
    WHEN "namespace" = 'ns' AND "name" = 'value_2' AND "version" = 2 THEN '[115 101 99 114 101 116 95 50]'
    END
  ),
  "data_key_id" = (
    CASE
    WHEN "namespace" = 'ns' AND "name" = 'value_1' AND "version" = 1 THEN 'key_1'
    WHEN "namespace" = 'ns' AND "name" = 'value_2' AND "version" = 2 THEN 'key_2'
    END
  ),
  "updated" = (
    CASE
    WHEN "namespace" = 'ns' AND "name" = 'value_1' AND "version" = 1 THEN 5679
    WHEN "namespace" = 'ns' AND "name" = 'value_2' AND "version" = 2 THEN 5680
    END
  )
WHERE ("namespace", "name", "version") IN (
  VALUES
  ('ns', 'value_1', 1)
  , ('ns', 'value_2', 2)
);
