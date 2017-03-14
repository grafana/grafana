package util

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestEncryption(t *testing.T) {

	Convey("When getting encryption key", t, func() {

		key := encryptionKeyToBytes("secret", "salt")
		So(len(key), ShouldEqual, 32)

		key = encryptionKeyToBytes("a very long secret key that is larger then 32bytes", "salt")
		So(len(key), ShouldEqual, 32)
	})

	Convey("When decrypting basic payload", t, func() {
		encrypted := Encrypt([]byte("grafana"), "1234")
		decrypted := Decrypt(encrypted, "1234")

		So(string(decrypted), ShouldEqual, "grafana")
	})

}
