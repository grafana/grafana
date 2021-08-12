package util

import "testing"

func SetEncryptionVariables(t *testing.T) {
	t.Helper()
	encr := Encrypt
	decr := Decrypt

	t.Cleanup(
		func() {
			Encrypt = encr
			Decrypt = decr
		})

	Encrypt = func(payload []byte, opt EncryptionOption) ([]byte, error) {
		return payload, nil
	}

	Decrypt = func(payload []byte) ([]byte, error) {
		return payload, nil
	}
}
