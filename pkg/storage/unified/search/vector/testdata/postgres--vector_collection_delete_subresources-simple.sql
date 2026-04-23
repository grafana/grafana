DELETE FROM vec_42
    WHERE "name" = 'abc-uid'
    AND "subresource" IN ('panel/1', 'panel/2')
;
