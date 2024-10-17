UPDATE {{ .Ident "secure_value" }} SET 
 "encrypted_provider"={{ .Arg .Encrypted.Provider }}, 
 "encrypted_kid"={{ .Arg .Encrypted.KID }}, 
 "encrypted_salt"={{ .Arg .Encrypted.Salt }}, 
 "encrypted_value"={{ .Arg .Encrypted.Value }}, 
 "encrypted_time"={{ .Arg .Timestamp }}, 
WHERE "uid"={{ .Arg .UID }}