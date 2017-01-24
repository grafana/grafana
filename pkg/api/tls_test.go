package api

import (
	"crypto/tls"
	"reflect"
	"testing"
)

func TestParseCiphers(t *testing.T) {
	testOk := "TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256,TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA,TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA,TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA,TLS_ECDHE_ECDSA_WITH_AES_256_CBC_SHA,TLS_RSA_WITH_AES_128_GCM_SHA256,TLS_RSA_WITH_AES_256_GCM_SHA384,TLS_RSA_WITH_AES_128_CBC_SHA,TLS_RSA_WITH_AES_256_CBC_SHA"
	v, err := ParseCiphers(testOk)
	if err != nil {
		t.Fatal(err)
	}
	if len(v) != 12 {
		t.Fatal("missed ciphers after parse")
	}

	testBad := "TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA,cipherX"
	if _, err := ParseCiphers(testBad); err == nil {
		t.Fatal("should fail on unsupported cipherX")
	}

	testOrder := "TLS_RSA_WITH_AES_256_GCM_SHA384,TLS_RSA_WITH_AES_128_GCM_SHA256"
	v, _ = ParseCiphers(testOrder)
	expected := []uint16{tls.TLS_RSA_WITH_AES_256_GCM_SHA384, tls.TLS_RSA_WITH_AES_128_GCM_SHA256}
	if !reflect.DeepEqual(expected, v) {
		t.Fatal("cipher order is not preserved")
	}
}
