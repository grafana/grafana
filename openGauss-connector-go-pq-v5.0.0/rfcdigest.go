package pq

import (
	"crypto/hmac"
	"crypto/sha1"
	"fmt"
	"strings"

	"crypto/sha256"

	"github.com/tjfoc/gmsm/sm3"
	"golang.org/x/crypto/pbkdf2"
)

func charToByte(c byte) byte {
	return byte(strings.Index("0123456789ABCDEF", string(c)))
}

func hexStringToBytes(hexString string) []byte {

	if hexString == "" {
		return []byte("")
	}

	upperString := strings.ToUpper(hexString)
	bytes_len := len(upperString) / 2
	array := make([]byte, bytes_len)

	for i := 0; i < bytes_len; i++ {
		pos := i * 2
		array[i] = byte(charToByte(upperString[pos])<<4 | charToByte(upperString[pos+1]))
	}
	return array
}
func generateKFromPBKDF2NoSerIter(password string, random64code string) []byte {
	return generateKFromPBKDF2(password, random64code, 2048)
}

func generateKFromPBKDF2(password string, random64code string, serverIteration int) []byte {
	random32code := hexStringToBytes(random64code)
	pwdEn := pbkdf2.Key([]byte(password), random32code, serverIteration, 32, sha1.New)
	return pwdEn
}

func bytesToHexString(src []byte) string {
	s := ""
	for i := 0; i < len(src); i++ {
		v := src[i] & 0xFF
		hv := fmt.Sprintf("%x", v)
		if len(hv) < 2 {
			s += hv
			s += "0"
		} else {
			s += hv
		}
	}
	return s
}

func getKeyFromHmac(key []byte, data []byte) []byte {
	h := hmac.New(sha256.New, key)
	h.Write(data)
	return h.Sum(nil)
}

func getSha256(message []byte) []byte {
	hash := sha256.New()
	hash.Write(message)

	return hash.Sum(nil)
}

func getSm3(message []byte) []byte {
	hash := sm3.New()
	hash.Write(message)

	return hash.Sum(nil)
}

func XorBetweenPassword(password1 []byte, password2 []byte, length int) []byte {
	array := make([]byte, length)
	for i := 0; i < length; i++ {
		array[i] = (password1[i] ^ password2[i])
	}
	return array
}

func bytesToHex(bytes []byte) []byte {
	lookup :=
		[16]byte{'0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'}
	result := make([]byte, len(bytes)*2)
	pos := 0
	for i := 0; i < len(bytes); i++ {
		c := int(bytes[i] & 0xFF)
		j := c >> 4
		result[pos] = lookup[j]
		pos++
		j = c & 0xF
		result[pos] = lookup[j]
		pos++
	}
	return result

}

/*
RFC5802Algorithm
   public static byte[] RFC5802Algorithm(
           String password, String random64code, String token, String server_signature, int server_iteration) {
       byte[] h = null;
       byte[] result = null;
       try {
           byte[] K = generateKFromPBKDF2(password, random64code, server_iteration);
           byte[] server_key = getKeyFromHmac(K, "Sever Key".getBytes("UTF-8"));
           byte[] client_key = getKeyFromHmac(K, "Client Key".getBytes("UTF-8"));
           byte[] stored_key = null;
           if (getIsSha256()) {
           	stored_key = sha256(client_key);
           } else {
           	stored_key = sm3(client_key);
           }
           byte[] tokenbyte = hexStringToBytes(token);
           byte[] client_signature = getKeyFromHmac(server_key, tokenbyte);
           if (server_signature != null && !server_signature.equals(bytesToHexString(client_signature))) return new byte[0];
           byte[] hmac_result = getKeyFromHmac(stored_key, tokenbyte);
           h = XOR_between_password(hmac_result, client_key, client_key.length);
           result = new byte[h.length * 2];
           bytesToHex(h, result, 0, h.length);
       } catch (Exception e) {
           LOGGER.info("RFC5802Algorithm failed. " + e.toString());
       }
       return result;
   }
*/
func RFC5802Algorithm(password string, random64code string, token string, serverSignature string, serverIteration int, method string) []byte {
	k := generateKFromPBKDF2(password, random64code, serverIteration)
	serverKey := getKeyFromHmac(k, []byte("Sever Key"))
	clientKey := getKeyFromHmac(k, []byte("Client Key"))
	var storedKey []byte

	if strings.EqualFold(method, "sha256") {
		storedKey = getSha256(clientKey)
	} else if strings.EqualFold(method, "sm3") {
		storedKey = getSm3(clientKey)
	}
	tokenByte := hexStringToBytes(token)
	clientSignature := getKeyFromHmac(serverKey, tokenByte)
	if serverSignature != "" && serverSignature != bytesToHexString(clientSignature) {
		return []byte("")
	}
	hmacResult := getKeyFromHmac(storedKey, tokenByte)
	h := XorBetweenPassword(hmacResult, clientKey, len(clientKey))
	result := bytesToHex(h)
	return result

}

/*
	Md5Sha256encode
   public static byte[] Md5Sha256encode(String password, String random64code, byte salt[]) {
       MessageDigest md;
       byte[] temp_digest, pass_digest;
       byte[] hex_digest = new byte[35];
       try {
           StringBuilder stringBuilder = new StringBuilder("");
           byte[] K = MD5Digest.generateKFromPBKDF2(password, random64code);
           byte[] server_key = MD5Digest.getKeyFromHmac(K, "Sever Key".getBytes("UTF-8"));
           byte[] client_key = MD5Digest.getKeyFromHmac(K, "Client Key".getBytes("UTF-8"));
           byte[] stored_key = MD5Digest.sha256(client_key);
           stringBuilder.append(random64code);
           stringBuilder.append(MD5Digest.bytesToHexString(server_key));
           stringBuilder.append(MD5Digest.bytesToHexString(stored_key));
           String EncryptString = stringBuilder.toString();
           md = MessageDigest.getInstance("MD5");
           md.update(EncryptString.getBytes("UTF-8"));
           md.update(salt);
           pass_digest = md.digest();
           bytesToHex(pass_digest, hex_digest, 3, 16);
           hex_digest[0] = (byte) 'm';
           hex_digest[1] = (byte) 'd';
           hex_digest[2] = (byte) '5';
       } catch (NoSuchAlgorithmException | UnsupportedEncodingException e) {
           LOGGER.info("MD5_SHA256encode failed. ", e);
       } catch (Exception e) {
           LOGGER.info("MD5_SHA256encode failed. ", e);
       }
       return hex_digest;
   }
*/
func Md5Sha256encode(password, random64code string, salt []byte) []byte {
	k := generateKFromPBKDF2NoSerIter(password, random64code)
	serverKey := getKeyFromHmac(k, []byte("Sever Key"))
	clientKey := getKeyFromHmac(k, []byte("Client Key"))
	storedKey := getSha256(clientKey)
	EncryptString := random64code + bytesToHexString(serverKey) + bytesToHexString(storedKey)
	passDigest := md5s(EncryptString + string(salt))
	return bytesToHex([]byte(passDigest)[:16])
}

/*
   public static byte[] SHA256_MD5encode(byte user[], byte password[], byte salt[]) {
       MessageDigest md, sha;
       byte[] temp_digest, pass_digest;
       byte[] hex_digest = new byte[70];
       try {
           md = MessageDigest.getInstance("MD5");
           md.update(password);
           md.update(user);
           temp_digest = md.digest();
           bytesToHex(temp_digest, hex_digest, 0, 16);
           sha = MessageDigest.getInstance("SHA-256");
           sha.update(hex_digest, 0, 32);
           sha.update(salt);
           pass_digest = sha.digest();
           bytesToHex(pass_digest, hex_digest, 6, 32);
           hex_digest[0] = (byte) 's';
           hex_digest[1] = (byte) 'h';
           hex_digest[2] = (byte) 'a';
           hex_digest[3] = (byte) '2';
           hex_digest[4] = (byte) '5';
           hex_digest[5] = (byte) '6';
       } catch (Exception e) {
           LOGGER.info("SHA256_MD5encode failed. " + e.toString());
       }
       return hex_digest;
   }
*/
