SELECT "namespace", "name", "counter"
FROM "secret_secure_value_counter" 
WHERE 
    "namespace" = 'ns' AND
    "name" = 'name'
