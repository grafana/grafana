EVP_BytesToKey
===

The super secure [key derivation algorithm from openssl](https://wiki.openssl.org/index.php/Manual:EVP_BytesToKey(3)) (spoiler alert not actually secure, only every use it for compatibility reasons).

Api:
===

```js
var result = EVP_BytesToKey('password', 'salt', keyLen, ivLen);
Buffer.isBuffer(result.password); // true
Buffer.isBuffer(result.iv); // true
```
