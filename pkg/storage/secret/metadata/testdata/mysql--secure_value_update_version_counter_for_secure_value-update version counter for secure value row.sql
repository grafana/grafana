UPDATE `secret_secure_value_counter` 
    SET `counter` = 2
WHERE
    `namespace` = 'ns' AND
    `name` = 'name' AND
    `counter` = 1;
