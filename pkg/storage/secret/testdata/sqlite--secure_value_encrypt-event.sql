UPDATE "secure_value" SET 
 "encrypted_provider"='', 
 "encrypted_kid"='KeyID', 
 "encrypted_salt"='TheSalt', 
 "encrypted_value"='EncryptedValue', 
 "encrypted_time"=12345, 
WHERE "uid"='ABCD'
