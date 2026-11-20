package resourcepb

import (
	"bytes"
	"fmt"
	"testing"

	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protodesc"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/types/dynamicpb"
)

func bulkBlobResource() *BulkRequest {
	return &BulkRequest{
		Key:    &ResourceKey{Namespace: "tenant", Group: "test.example", Resource: "examples", Name: "example"},
		Action: BulkRequest_ADDED,
		Value:  []byte(`{"metadata":{"name":"example"},"spec":{"title":"preserved"}}`),
		BlobUploads: []*BulkBlobUpload{{
			Name: "dashboard", ContentType: "application/json", Size: 2,
		}},
	}
}

func TestValidateBulkBlobResourceFrame(t *testing.T) {
	for _, tc := range []struct {
		name    string
		mutate  func(*BulkRequest)
		wantErr bool
	}{
		{"valid", func(*BulkRequest) {}, false},
		{"update", func(r *BulkRequest) { r.Action = BulkRequest_MODIFIED }, false},
		{"backend size boundary", func(r *BulkRequest) { r.BlobUploads[0].Size = 64 << 20 }, false},
		{"delete", func(r *BulkRequest) { r.Action = BulkRequest_DELETED }, true},
		{"unknown action", func(r *BulkRequest) { r.Action = BulkRequest_UNKNOWN }, true},
		{"missing key", func(r *BulkRequest) { r.Key = nil }, true},
		{"missing body", func(r *BulkRequest) { r.Value = nil }, true},
		{"nil declaration", func(r *BulkRequest) { r.BlobUploads[0] = nil }, true},
		{"empty name", func(r *BulkRequest) { r.BlobUploads[0].Name = "" }, true},
		{"blank name", func(r *BulkRequest) { r.BlobUploads[0].Name = " " }, true},
		{"duplicate name", func(r *BulkRequest) { r.BlobUploads = append(r.BlobUploads, r.BlobUploads[0]) }, true},
		{"empty content type", func(r *BulkRequest) { r.BlobUploads[0].ContentType = "" }, true},
		{"invalid content type", func(r *BulkRequest) { r.BlobUploads[0].ContentType = "json" }, true},
		{"wildcard content type", func(r *BulkRequest) { r.BlobUploads[0].ContentType = "image/*" }, true},
		{"empty content", func(r *BulkRequest) { r.BlobUploads[0].Size = 0 }, true},
		{"negative size", func(r *BulkRequest) { r.BlobUploads[0].Size = -1 }, true},
		{"backend size overflow", func(r *BulkRequest) { r.BlobUploads[0].Size = 64<<20 + 1 }, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			req := bulkBlobResource()
			tc.mutate(req)
			if err := ValidateBulkBlobFrame(req); (err != nil) != tc.wantErr {
				t.Fatalf("error = %v, wantErr = %v", err, tc.wantErr)
			}
		})
	}
	for _, count := range []int{MaxInlineBlobEntries, MaxInlineBlobEntries + 1} {
		req := bulkBlobResource()
		req.BlobUploads = nil
		for i := range count {
			req.BlobUploads = append(req.BlobUploads, &BulkBlobUpload{Name: fmt.Sprint(i), ContentType: "image/png", Size: 1})
		}
		if err := ValidateBulkBlobFrame(req); (err != nil) != (count > MaxInlineBlobEntries) {
			t.Fatalf("count %d: error = %v", count, err)
		}
	}
}

func TestValidateBulkBlobChunkFrame(t *testing.T) {
	for _, tc := range []struct {
		name    string
		chunk   *BulkBlobChunk
		wantErr bool
	}{
		{"binary bytes", &BulkBlobChunk{Name: "image", Value: []byte{0, 255}}, false},
		{"full chunk", &BulkBlobChunk{Name: "image", Value: make([]byte, BulkBlobChunkSize)}, false},
		{"EOF", &BulkBlobChunk{Name: "image", Last: true}, false},
		{"empty name", &BulkBlobChunk{Value: []byte{1}}, true},
		{"blank name", &BulkBlobChunk{Name: " ", Last: true}, true},
		{"empty data without EOF", &BulkBlobChunk{Name: "image"}, true},
		{"oversized chunk", &BulkBlobChunk{Name: "image", Value: make([]byte, BulkBlobChunkSize+1)}, true},
		{"data with EOF", &BulkBlobChunk{Name: "image", Value: []byte{1}, Last: true}, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if err := ValidateBulkBlobFrame(&BulkRequest{BlobChunk: tc.chunk}); (err != nil) != tc.wantErr {
				t.Fatalf("error = %v, wantErr = %v", err, tc.wantErr)
			}
		})
	}
	for name, mutate := range map[string]func(*BulkRequest){
		"key":          func(r *BulkRequest) { r.Key = &ResourceKey{} },
		"action":       func(r *BulkRequest) { r.Action = BulkRequest_ADDED },
		"value":        func(r *BulkRequest) { r.Value = []byte(`{}`) },
		"folder":       func(r *BulkRequest) { r.Folder = "folder" },
		"declarations": func(r *BulkRequest) { r.BlobUploads = bulkBlobResource().BlobUploads },
	} {
		t.Run("mixed fields/"+name, func(t *testing.T) {
			req := &BulkRequest{BlobChunk: &BulkBlobChunk{Name: "image", Last: true}}
			mutate(req)
			if err := ValidateBulkBlobFrame(req); err == nil {
				t.Fatal("expected mixed resource/chunk frame to be rejected")
			}
		})
	}
}

func TestBulkBlobFramesDoNotChangeLegacyRequests(t *testing.T) {
	for _, action := range []BulkRequest_Action{BulkRequest_ADDED, BulkRequest_MODIFIED, BulkRequest_DELETED} {
		req := bulkBlobResource()
		req.BlobUploads = nil
		req.Action = action
		before := proto.Clone(req)
		if err := ValidateBulkBlobFrame(req); err != nil {
			t.Fatal(err)
		}
		if !proto.Equal(req, before) {
			t.Fatal("validation changed a legacy request")
		}
	}
	if err := ValidateBulkBlobFrame(nil); err == nil {
		t.Fatal("expected nil request to be rejected")
	}
	fields := (&BulkRequest{}).ProtoReflect().Descriptor().Fields()
	for name, number := range map[protoreflect.Name]protoreflect.FieldNumber{
		"key": 1, "action": 2, "value": 3, "folder": 4, "blob_uploads": 5, "blob_chunk": 6,
	} {
		if field := fields.ByName(name); field == nil || field.Number() != number {
			t.Fatalf("unexpected wire field for %s: %v", name, field)
		}
	}
}

func TestBulkBlobFieldsAreIgnoredByOlderDescriptors(t *testing.T) {
	file := protodesc.ToFileDescriptorProto(File_resource_proto)
	for _, message := range file.MessageType {
		if message.GetName() == "BulkRequest" {
			message.Field = message.Field[:4]
		}
	}
	legacyFile, err := protodesc.NewFile(file, nil)
	if err != nil {
		t.Fatal(err)
	}
	legacyDescriptor := legacyFile.Messages().ByName("BulkRequest")
	req := bulkBlobResource()
	wire, err := proto.Marshal(req)
	if err != nil {
		t.Fatal(err)
	}
	legacy := dynamicpb.NewMessage(legacyDescriptor)
	if err := proto.Unmarshal(wire, legacy); err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(legacy.Get(legacyDescriptor.Fields().ByName("value")).Bytes(), req.Value) {
		t.Fatal("legacy resource body changed")
	}
	// Old servers can read the resource but cannot interpret its uploads. This
	// is why successful RPC creation is not enough: acknowledgement is required.
	if len(legacy.GetUnknown()) == 0 {
		t.Fatal("expected upload declarations to be unknown to the old descriptor")
	}
	legacy.SetUnknown(nil)
	legacyWire, err := proto.Marshal(legacy)
	if err != nil {
		t.Fatal(err)
	}
	var decoded BulkRequest
	if err := proto.Unmarshal(legacyWire, &decoded); err != nil {
		t.Fatal(err)
	}
	req.BlobUploads = nil
	if !proto.Equal(req, &decoded) {
		t.Fatal("legacy fields did not retain their wire representation")
	}
}

func TestBulkBlobWireSupportsBackendLimitWithBoundedMessages(t *testing.T) {
	// This is a wire-contract test, not an upload implementation. A 64 MiB blob
	// travels without allocating a 64 MiB resource message or base64 payload.
	const backendLimit = 64 << 20
	req := bulkBlobResource()
	req.BlobUploads[0].Size = backendLimit
	roundTrip := func(req *BulkRequest) *BulkRequest {
		t.Helper()
		if err := ValidateBulkBlobFrame(req); err != nil {
			t.Fatal(err)
		}
		wire, err := proto.Marshal(req)
		if err != nil {
			t.Fatal(err)
		}
		if len(wire) >= 4<<20 {
			t.Fatalf("message exceeds default gRPC limit: %d", len(wire))
		}
		var decoded BulkRequest
		if err := proto.Unmarshal(wire, &decoded); err != nil {
			t.Fatal(err)
		}
		if !proto.Equal(req, &decoded) {
			t.Fatal("frame changed on wire")
		}
		return &decoded
	}
	declaration := roundTrip(req)
	chunk := &BulkRequest{BlobChunk: &BulkBlobChunk{Name: "dashboard", Value: bytes.Repeat([]byte{255}, BulkBlobChunkSize)}}
	var received int64
	for received < declaration.BlobUploads[0].Size {
		received += int64(len(roundTrip(chunk).BlobChunk.Value))
	}
	end := roundTrip(&BulkRequest{BlobChunk: &BulkBlobChunk{Name: "dashboard", Last: true}})
	if !end.BlobChunk.Last || received != declaration.BlobUploads[0].Size {
		t.Fatalf("incomplete blob: received %d bytes", received)
	}
}
