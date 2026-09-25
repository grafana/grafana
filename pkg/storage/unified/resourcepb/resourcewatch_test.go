package resourcepb

import (
	"slices"
	"testing"

	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protodesc"
	"google.golang.org/protobuf/types/descriptorpb"
	"google.golang.org/protobuf/types/dynamicpb"
)

func TestWatchNotificationPreviousMetadataCompatibility(t *testing.T) {
	// Model the schema used by consumers and publishers before enrichment.
	legacySchema := protodesc.ToFileDescriptorProto(File_resourcewatch_proto)
	for _, message := range legacySchema.MessageType {
		message.Field = slices.DeleteFunc(message.Field, func(field *descriptorpb.FieldDescriptorProto) bool {
			return field.GetNumber() > 8
		})
	}
	legacyFile, err := protodesc.NewFile(legacySchema, nil)
	if err != nil {
		t.Fatal(err)
	}

	event := &WatchNotification{
		Type:                    WatchNotification_MODIFIED,
		Group:                   "playlist.grafana.app",
		Resource:                "playlists",
		Namespace:               "default",
		Name:                    "playlist-1",
		ResourceVersion:         42,
		Folder:                  "new-folder",
		PreviousResourceVersion: 41,
		PreviousType:            WatchNotification_ADDED,
		PreviousFolder:          "old-folder",
	}
	payload, err := proto.Marshal(event)
	if err != nil {
		t.Fatal(err)
	}

	legacy := dynamicpb.NewMessage(legacyFile.Messages().ByName("WatchNotification"))
	if err := (proto.UnmarshalOptions{DiscardUnknown: true}).Unmarshal(payload, legacy); err != nil {
		t.Fatalf("old consumers must accept enriched notifications: %v", err)
	}

	// Re-encoding with the old schema produces the payload an old publisher sends.
	legacyPayload, err := proto.Marshal(legacy)
	if err != nil {
		t.Fatal(err)
	}
	var decoded WatchNotification
	if err := proto.Unmarshal(legacyPayload, &decoded); err != nil {
		t.Fatalf("new consumers must accept old notifications: %v", err)
	}
	expected := proto.Clone(event).(*WatchNotification)
	expected.PreviousType = WatchNotification_UNKNOWN
	expected.PreviousFolder = ""
	if !proto.Equal(expected, &decoded) {
		t.Fatalf("legacy fields must survive while previous metadata defaults to unavailable: got %v, want %v", &decoded, expected)
	}
}
