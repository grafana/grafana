package resourcepb

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"testing"

	"google.golang.org/grpc/metadata"
)

func TestDecodeBlobEntries(t *testing.T) {
	for _, tc := range []struct {
		name  string
		value string
	}{
		{"empty object", `{}`},
		{"reference", `{"dashboard":{"uid":"existing"}}`},
		{"reference metadata", `{"dashboard":{"uid":"existing","contentType":"application/json","size":123,"hash":"abc","extension":true}}`},
		{"inline", `{"dashboard":{"contentType":"application/json","data":"e30="}}`},
		{"binary and reference", `{"image":{"contentType":"image/png","data":"AP8="},"dashboard":{"uid":"existing"}}`},
		{"media type parameters", `{"a":{"contentType":"text/plain; charset=utf-8","data":"YQ=="}}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			entries, err := DecodeBlobEntries(json.RawMessage(tc.value))
			if err != nil {
				t.Fatal(err)
			}
			if entry, ok := entries["image"]; ok && !bytes.Equal(entry.Data, []byte{0, 255}) {
				t.Fatalf("unexpected decoded binary: %v", entry.Data)
			}
		})
	}
}

func TestDecodeBlobEntriesUsesExactFieldNames(t *testing.T) {
	entries, err := DecodeBlobEntries(json.RawMessage(`{"a":{"uid":"existing","Data":"YQ==","Size":10}}`))
	if err != nil {
		t.Fatal(err)
	}
	if entries["a"].UID != "existing" || len(entries["a"].Data) != 0 || entries["a"].Size != 0 {
		t.Fatalf("extension fields interpreted as contract fields: %+v", entries["a"])
	}
}

func TestDecodeBlobEntriesRejectsInvalidInput(t *testing.T) {
	for name, value := range map[string]string{
		"missing object":    ``,
		"null object":       `null`,
		"array object":      `[]`,
		"null entry":        `{"a":null}`,
		"duplicate entry":   `{"a":{"uid":"one"},"a":{"uid":"two"}}`,
		"duplicate field":   `{"a":{"uid":"one","uid":"two"}}`,
		"trailing content":  `{} {}`,
		"truncated object":  `{"a":{"uid":"id"}`,
		"array entry":       `{"a":[]}`,
		"missing identity":  `{"a":{}}`,
		"ambiguous":         `{"a":{"uid":"id","data":"YQ==","contentType":"text/plain"}}`,
		"null data and uid": `{"a":{"uid":"id","data":null}}`,
		"null uid":          `{"a":{"uid":null}}`,
		"empty uid":         `{"a":{"uid":""}}`,
		"blank uid":         `{"a":{"uid":" "}}`,
		"numeric uid":       `{"a":{"uid":1}}`,
		"invalid metadata":  `{"a":{"uid":"id","size":"1"}}`,
		"empty name":        `{"":{"data":"YQ==","contentType":"text/plain"}}`,
		"empty data":        `{"a":{"data":"","contentType":"text/plain"}}`,
		"null data":         `{"a":{"data":null,"contentType":"text/plain"}}`,
		"array data":        `{"a":{"data":[1],"contentType":"text/plain"}}`,
		"malformed base64":  `{"a":{"data":"!","contentType":"text/plain"}}`,
		"unpadded base64":   `{"a":{"data":"YQ","contentType":"text/plain"}}`,
		"nonzero pad bits":  `{"a":{"data":"YR==","contentType":"text/plain"}}`,
		"base64 newline":    `{"a":{"data":"YQ==\n","contentType":"text/plain"}}`,
		"unknown inline":    `{"a":{"data":"YQ==","contentType":"text/plain","extra":true}}`,
		"inline size":       `{"a":{"data":"YQ==","contentType":"text/plain","size":1}}`,
		"missing type":      `{"a":{"data":"YQ=="}}`,
		"null type":         `{"a":{"data":"YQ==","contentType":null}}`,
		"empty type":        `{"a":{"data":"YQ==","contentType":""}}`,
		"invalid type":      `{"a":{"data":"YQ==","contentType":"not a type"}}`,
		"incomplete type":   `{"a":{"data":"YQ==","contentType":"json"}}`,
		"wildcard type":     `{"a":{"data":"YQ==","contentType":"image/*"}}`,
	} {
		t.Run(name, func(t *testing.T) {
			if _, err := DecodeBlobEntries(json.RawMessage(value)); err == nil {
				t.Fatal("expected validation error")
			}
		})
	}
}

func TestInlineBlobDataLimit(t *testing.T) {
	// Exercise both encoded-length and exact decoded-length boundaries without
	// allocating backend-sized bodies in unit tests.
	const limit = 4
	for _, size := range []int{3, 4, 5, 7} {
		raw, err := json.Marshal(bytes.Repeat([]byte{255}, size))
		if err != nil {
			t.Fatal(err)
		}
		data, err := decodeInlineBlobData(raw, limit)
		if (err != nil) != (size > limit) {
			t.Fatalf("size %d: error = %v", size, err)
		}
		if err == nil && len(data) != size {
			t.Fatalf("size %d: decoded %d bytes", size, len(data))
		}
	}
}

func TestInlineBlobsDoNotHaveResourceMessageSizeLimits(t *testing.T) {
	// HTTP input is split before gRPC transport. Neither a 1 MiB per-blob cap
	// nor a 2 MiB aggregate cap should be inferred from gRPC message limits.
	blob := BlobEntry{ContentType: "application/octet-stream", Data: bytes.Repeat([]byte{255}, 2<<20+1)}
	raw, err := json.Marshal(map[string]BlobEntry{"a": blob, "b": blob})
	if err != nil {
		t.Fatal(err)
	}
	entries, err := DecodeBlobEntries(raw)
	if err != nil {
		t.Fatal(err)
	}
	for name, entry := range entries {
		if !bytes.Equal(entry.Data, blob.Data) {
			t.Fatalf("blob %q lost bytes", name)
		}
	}
}

func TestInlineBlobEntryLimit(t *testing.T) {
	for _, count := range []int{MaxInlineBlobEntries, MaxInlineBlobEntries + 1} {
		entries := make(map[string]BlobEntry)
		for i := range count {
			entries[fmt.Sprint(i)] = BlobEntry{ContentType: "application/octet-stream", Data: []byte{255}}
		}
		raw, err := json.Marshal(entries)
		if err != nil {
			t.Fatal(err)
		}
		_, err = DecodeBlobEntries(raw)
		if (err != nil) != (count > MaxInlineBlobEntries) {
			t.Fatalf("count %d: error = %v", count, err)
		}
	}
	// The new limits must not restrict reference-only resources.
	references := make(map[string]BlobEntry)
	for i := range MaxInlineBlobEntries + 1 {
		references[fmt.Sprint(i)] = BlobEntry{UID: "existing"}
	}
	raw, err := json.Marshal(references)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := DecodeBlobEntries(raw); err != nil {
		t.Fatal(err)
	}
}

func TestBlobEntryJSONUsesBase64(t *testing.T) {
	raw, err := json.Marshal(BlobEntry{ContentType: "image/png", Data: []byte{0, 255}})
	if err != nil {
		t.Fatal(err)
	}
	var fields map[string]string
	if err := json.Unmarshal(raw, &fields); err != nil {
		t.Fatal(err)
	}
	if fields["data"] != base64.StdEncoding.EncodeToString([]byte{0, 255}) {
		t.Fatalf("unexpected data: %s", fields["data"])
	}
}

func TestBlobReferenceJSONIsReferenceOnly(t *testing.T) {
	reference := BlobReference{
		UID:         "uploaded-uid",
		ContentType: "application/json",
		Size:        2,
		Hash:        "server-hash",
	}
	// Exercise the same shape for a single resource and a LIST item.
	resource := struct {
		Blobs map[string]BlobReference `json:"blobs"`
	}{Blobs: map[string]BlobReference{"dashboard": reference}}
	for name, response := range map[string]any{
		"GET": resource,
		"LIST": struct {
			Items []any `json:"items"`
		}{Items: []any{resource}},
	} {
		t.Run(name, func(t *testing.T) {
			raw, err := json.Marshal(response)
			if err != nil {
				t.Fatal(err)
			}
			if bytes.Contains(raw, []byte(`"data"`)) {
				t.Fatalf("read-side shape exposes data: %s", raw)
			}
			if !bytes.Contains(raw, []byte(`"uid":"uploaded-uid"`)) {
				t.Fatalf("read-side shape lost reference: %s", raw)
			}
		})
	}
}

func TestValidateInlineBlobAcknowledgement(t *testing.T) {
	for _, tc := range []struct {
		name    string
		header  metadata.MD
		wantErr bool
	}{
		{"supported", metadata.Pairs(InlineBlobMetadataKey, "1"), false},
		{"supported with unrelated metadata", metadata.Pairs(InlineBlobMetadataKey, "1", "other", "value"), false},
		{"nil headers", nil, true},
		{"empty headers", metadata.MD{}, true},
		{"unrelated headers", metadata.Pairs("other", "value"), true},
		{"no values", metadata.MD{InlineBlobMetadataKey: nil}, true},
		{"empty version", metadata.Pairs(InlineBlobMetadataKey, ""), true},
		{"unsupported", metadata.Pairs(InlineBlobMetadataKey, "0"), true},
		{"unknown version", metadata.Pairs(InlineBlobMetadataKey, "2"), true},
		{"malformed version", metadata.Pairs(InlineBlobMetadataKey, "true"), true},
		{"noncanonical version", metadata.Pairs(InlineBlobMetadataKey, "01"), true},
		{"duplicate versions", metadata.Pairs(InlineBlobMetadataKey, "1", InlineBlobMetadataKey, "1"), true},
		{"conflicting versions", metadata.Pairs(InlineBlobMetadataKey, "1", InlineBlobMetadataKey, "0"), true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			err := ValidateInlineBlobAcknowledgement(tc.header)
			if (err != nil) != tc.wantErr {
				t.Fatalf("error = %v, wantErr = %v", err, tc.wantErr)
			}
		})
	}
}
