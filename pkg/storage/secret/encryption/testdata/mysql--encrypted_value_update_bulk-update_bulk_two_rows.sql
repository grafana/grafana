UPDATE
  `secret_encrypted_value`
SET
  `encrypted_data` = (
    CASE
    WHEN `namespace` = 'ns' AND `name` = 'n1' AND `version` = 1 THEN '[115 101 99 114 101 116 49]'
    WHEN `namespace` = 'ns' AND `name` = 'n2' AND `version` = 2 THEN '[115 101 99 114 101 116 50]'
    END
  ),
  `data_key_id` = (
    CASE
    WHEN `namespace` = 'ns' AND `name` = 'n1' AND `version` = 1 THEN 'key1'
    WHEN `namespace` = 'ns' AND `name` = 'n2' AND `version` = 2 THEN 'key2'
    END
  ),
  `updated` = (
    CASE
    WHEN `namespace` = 'ns' AND `name` = 'n1' AND `version` = 1 THEN 5679
    WHEN `namespace` = 'ns' AND `name` = 'n2' AND `version` = 2 THEN 5680
    END
  )
WHERE (`namespace`, `name`, `version`) IN (
  VALUES
  ('ns', 'n1', 1)
  , ('ns', 'n2', 2)
);
