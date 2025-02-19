UPDATE "resource_history"
    SET "value" = REPLACE("value", CONCAT('"uid":"', 'old-uid', '"'), CONCAT('"uid":"', 'new-uid', '"'))
    WHERE "name" = 'name'
    AND "namespace" = 'nn'
    AND "group"     = 'gg'
    AND "resource"  = 'rr'
    AND "action" != 3
    AND "value" NOT LIKE '%deletionTimestamp%';
