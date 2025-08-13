package pq

import (
	"reflect"
	"strings"
	"testing"
)

func TestDecodeUUIDBinaryError(t *testing.T) {
	t.Parallel()
	_, err := decodeUUIDBinary([]byte{0x12, 0x34})

	if err == nil {
		t.Fatal("Expected error, got none")
	}
	if !strings.HasPrefix(err.Error(), "pq:") {
		t.Errorf("Expected error to start with %q, got %q", "pq:", err.Error())
	}
	if !strings.Contains(err.Error(), "bad length: 2") {
		t.Errorf("Expected error to contain length, got %q", err.Error())
	}
}

func BenchmarkDecodeUUIDBinary(b *testing.B) {
	x := []byte{0x03, 0xa3, 0x52, 0x2f, 0x89, 0x28, 0x49, 0x87, 0x84, 0xd6, 0x93, 0x7b, 0x36, 0xec, 0x27, 0x6f}

	for i := 0; i < b.N; i++ {
		decodeUUIDBinary(x)
	}
}

func TestDecodeUUIDBackend(t *testing.T) {
	db := openTestConn(t)
	defer db.Close()

	var s = "a0ecc91d-a13f-4fe4-9fce-7e09777cc70a"
	var scanned interface{}

	err := db.QueryRow(`SELECT $1::uuid`, s).Scan(&scanned)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if !reflect.DeepEqual(scanned, []byte(s)) {
		t.Errorf("Expected []byte(%q), got %T(%q)", s, scanned, scanned)
	}
}
