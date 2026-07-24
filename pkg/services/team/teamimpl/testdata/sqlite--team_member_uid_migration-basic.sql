UPDATE "test_schema"."team_member" SET uid = printf('tm%09d', id) WHERE uid IS NULL OR uid = ''
