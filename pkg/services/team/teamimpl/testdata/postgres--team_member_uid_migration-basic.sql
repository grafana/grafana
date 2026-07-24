UPDATE "test_schema"."team_member" SET uid = 'tm' || lpad('' || id::text, 9, '0') WHERE uid IS NULL OR uid = ''
