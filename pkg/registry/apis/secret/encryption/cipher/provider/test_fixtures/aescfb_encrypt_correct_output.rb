#!/usr/bin/env ruby
# Used by ../decipher_aescfb_test.go
# Why Ruby? It has a mostly available OpenSSL library that can be easily fetched (and most who have Ruby already have it!). And it is easy to read for this purpose.

require 'openssl'

salt = "abcdefgh"
nonce = "1234567890124567"

secret = "secret here"
plaintext = "grafana unit test"

# reimpl of aes256CipherKey
# the key is always the same value given the inputs
iterations = 10_000
len = 32
hash = OpenSSL::Digest::SHA256.new
key = OpenSSL::KDF.pbkdf2_hmac(secret, salt: salt, iterations: iterations, length: len, hash: hash)

cipher = OpenSSL::Cipher::AES256.new(:CFB).encrypt
cipher.iv = nonce
cipher.key = key
encrypted = cipher.update(plaintext)

def to_hex(s)
  s.unpack('H*').first
end

# Salt       Nonce          Encrypted
# |            |             Payload 
# |            |                |    
# |  +---------v-------------+  |    
# +-->SSSSSSSNNNNNNNEEEEEEEEE<--+    
#    +-----------------------+       
printf("%s%s%s%s\n", to_hex(salt), to_hex(nonce), cipher.final, to_hex(encrypted))
