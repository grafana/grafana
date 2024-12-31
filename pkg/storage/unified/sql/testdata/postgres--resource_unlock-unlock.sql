DELETE FROM "resource_lock"
    WHERE 1 = 1
    AND "group"     = 'gp'
    AND "resource"  = 'rs'
    AND "namespace" = 'ns'
    AND "name"      = 'nm';
