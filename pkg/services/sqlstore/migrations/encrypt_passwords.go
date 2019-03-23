package migrations

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"github.com/go-xorm/xorm"
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"hash"
	"io"
)

type AddEncryptPasswordsMigration struct {
	MigrationBase
}

func (m *AddEncryptPasswordsMigration) Sql(dialect Dialect) string {
	return "code migration"
}

func (m *AddEncryptPasswordsMigration) Exec(sess *xorm.Session, mg *Migrator) error {
	var passwordRows []map[string]string
	datasourceTypes := []string{
		"mysql",
		"influxdb",
		"elasticsearch",
		"graphite",
		"prometheus",
		"opentsdb",
	}

	sess.Cols("id", "password", "secure_json_data")
	sess.Table("data_source")
	sess.In("type", datasourceTypes)
	sess.Where("password IS NOT NULL")
	err := sess.Find(&passwordRows)
	if err != nil {
		return fmt.Errorf("password select failed: %v", err)
	}

	if err := updateRows(sess, passwordRows, "password"); err != nil {
		return fmt.Errorf("password updates failed: %v", err)
	}

	var basicAuthRows []map[string]string
	sess.Cols("id", "basic_auth_password", "secure_json_data")
	sess.Table("data_source")
	sess.In("type", datasourceTypes)
	sess.Where("basic_auth_password IS NOT NULL")
	err = sess.Find(&basicAuthRows)
	if err != nil {
		return fmt.Errorf("basic_auth_password select failed: %v", err)
	}

	if err := updateRows(sess, basicAuthRows, "basic_auth_password"); err != nil {
		return fmt.Errorf("basic_auth_password updates failed: %v", err)
	}

	return nil
}

// addEncryptPasswordsMigration will move unencrypted passwords from password and basic_auth_password fields into
// secure_json_data and encrypt them. This is done only for some core datasources that did not use the encrypted storage
// until now.
func addEncryptPasswordsMigration(mg *Migrator) {
	mg.AddMigration("Encrypt datasource password", &AddEncryptPasswordsMigration{})
}

func updateRows(session *xorm.Session, rows []map[string]string, passwordFieldName string) error {
	for _, row := range rows {
		newSecureJsonData, err := getUpdatedSecureJsonData(row, passwordFieldName)
		if err != nil {
			return err
		}

		data, err := json.Marshal(newSecureJsonData)
		if err != nil {
			return fmt.Errorf("marshaling newSecureJsonData failed: %v", err)
		}
		newRow := map[string]interface{}{"secure_json_data": data, passwordFieldName: ""}
		session.Table("data_source")
		session.Where("id = ?", row["id"])
		// Setting both columns while having value only for secure_json_data should clear the [passwordFieldName] column
		session.Cols("secure_json_data", passwordFieldName)
		_, err = session.Update(newRow)
		if err != nil {
			return err
		}
	}
	return nil
}

func getUpdatedSecureJsonData(row map[string]string, passwordFieldName string) (map[string]interface{}, error) {
	encryptedPassword, err := encrypt([]byte(row[passwordFieldName]), setting.SecretKey)
	if err != nil {
		return nil, err
	}

	var secureJsonData map[string]interface{}

	if err := json.Unmarshal([]byte(row["secure_json_data"]), &secureJsonData); err != nil {
		return nil, err
	}

	jsonFieldName := util.ToCamelCase(passwordFieldName)
	secureJsonData[jsonFieldName] = encryptedPassword
	return secureJsonData, nil
}

//
// All functions below are copy pasted from encryption.go and encoding.go to keep this migration as stable as possible.
// So if the encryption changes this will still encrypt passwords the way the migration was created (though if some
// of the imports change this could also change the encryption, bit I think they should be reasonably stable)
//

const saltLength = 8

// GetRandomString generate random string by specify chars.
// source: https://github.com/gogits/gogs/blob/9ee80e3e5426821f03a4e99fad34418f5c736413/modules/base/tool.go#L58
func GetRandomString(n int, alphabets ...byte) string {
	const alphanum = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
	var bytes = make([]byte, n)
	rand.Read(bytes)
	for i, b := range bytes {
		if len(alphabets) == 0 {
			bytes[i] = alphanum[b%byte(len(alphanum))]
		} else {
			bytes[i] = alphabets[b%byte(len(alphabets))]
		}
	}
	return string(bytes)
}

// PBKDF2 implements Password-Based Key Derivation Function 2), aimed to reduce
// the vulnerability of encrypted keys to brute force attacks.
// http://code.google.com/p/go/source/browse/pbkdf2/pbkdf2.go?repo=crypto
func PBKDF2(password, salt []byte, iter, keyLen int, h func() hash.Hash) []byte {
	prf := hmac.New(h, password)
	hashLen := prf.Size()
	numBlocks := (keyLen + hashLen - 1) / hashLen

	var buf [4]byte
	dk := make([]byte, 0, numBlocks*hashLen)
	U := make([]byte, hashLen)
	for block := 1; block <= numBlocks; block++ {
		// N.B.: || means concatenation, ^ means XOR
		// for each block T_i = U_1 ^ U_2 ^ ... ^ U_iter
		// U_1 = PRF(password, salt || uint(i))
		prf.Reset()
		prf.Write(salt)
		buf[0] = byte(block >> 24)
		buf[1] = byte(block >> 16)
		buf[2] = byte(block >> 8)
		buf[3] = byte(block)
		prf.Write(buf[:4])
		dk = prf.Sum(dk)
		T := dk[len(dk)-hashLen:]
		copy(U, T)

		// U_n = PRF(password, U_(n-1))
		for n := 2; n <= iter; n++ {
			prf.Reset()
			prf.Write(U)
			U = U[:0]
			U = prf.Sum(U)
			for x := range U {
				T[x] ^= U[x]
			}
		}
	}
	return dk[:keyLen]
}

// Encrypt encrypts a payload with a given secret.
func encrypt(payload []byte, secret string) ([]byte, error) {
	salt := GetRandomString(saltLength)

	key := encryptionKeyToBytes(secret, salt)
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	// The IV needs to be unique, but not secure. Therefore it's common to
	// include it at the beginning of the ciphertext.
	ciphertext := make([]byte, saltLength+aes.BlockSize+len(payload))
	copy(ciphertext[:saltLength], []byte(salt))
	iv := ciphertext[saltLength : saltLength+aes.BlockSize]
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return nil, err
	}

	stream := cipher.NewCFBEncrypter(block, iv)
	stream.XORKeyStream(ciphertext[saltLength+aes.BlockSize:], payload)

	return ciphertext, nil
}

// Key needs to be 32bytes
func encryptionKeyToBytes(secret, salt string) []byte {
	return PBKDF2([]byte(secret), []byte(salt), 10000, 32, sha256.New)
}
