package resourcepb

import (
	"testing"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/encoding/protowire"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/types/known/anypb"
)

func TestCallLevelErrorFieldsRetired(t *testing.T) {
	for _, tc := range []struct {
		message proto.Message
		number  protoreflect.FieldNumber
	}{
		{&PutBlobResponse{}, 1},
		{&GetBlobResponse{}, 1},
		{&CreateResponse{}, 1},
		{&UpdateResponse{}, 1},
		{&DeleteResponse{}, 1},
		{&ReadResponse{}, 1},
		{&ListResponse{}, 5},
		{&BulkResponse{}, 1},
		{&ListManagedObjectsResponse{}, 3},
		{&CountManagedObjectsResponse{}, 2},
		{&QuotaUsageResponse{}, 1},
		{&ResourceStatsResponse{}, 1},
		{&ResourceSearchResponse{}, 1},
		{&RebuildIndexesResponse{}, 3},
		{&VectorSearchResponse{}, 1},
	} {
		d := tc.message.ProtoReflect().Descriptor()
		t.Run(string(d.Name()), func(t *testing.T) {
			if d.Fields().ByName("error") != nil || d.Fields().ByNumber(tc.number) != nil {
				t.Fatal("call-level error field must be absent")
			}
			if !d.ReservedNames().Has("error") || !d.ReservedRanges().Has(tc.number) {
				t.Fatal("retired error field name and number must stay reserved")
			}
		})
	}
}

func TestErrorStatusDetailsContract(t *testing.T) {
	want := &ErrorResult{Code: 409, Reason: "Conflict", Message: "write conflict", Details: &ErrorDetails{
		Name: "dashboard", Group: "dashboard.grafana.app", Kind: "Dashboard", Uid: "uid", RetryAfterSeconds: 3,
		Causes: []*ErrorCause{{Reason: "Conflict", Message: "stale version", Field: "metadata.resourceVersion"}},
	}}
	for _, tc := range []struct {
		message proto.Message
		name    string
	}{
		{want, "resource.ErrorResult"},
		{want.Details, "resource.ErrorDetails"},
		{want.Details.Causes[0], "resource.ErrorCause"},
	} {
		packed, err := anypb.New(tc.message)
		if err != nil {
			t.Fatal(err)
		}
		if packed.TypeUrl != "type.googleapis.com/"+tc.name {
			t.Fatalf("status detail type identity changed: %s", packed.TypeUrl)
		}
		decoded, err := packed.UnmarshalNew()
		if err != nil || !proto.Equal(tc.message, decoded) {
			t.Fatalf("detail decoding failed: %v", err)
		}
	}
	st, err := status.New(codes.Aborted, "write conflict").WithDetails(want)
	if err != nil {
		t.Fatal(err)
	}
	wire, err := proto.Marshal(st.Proto())
	if err != nil {
		t.Fatal(err)
	}
	decoded := st.Proto()
	proto.Reset(decoded)
	if err := proto.Unmarshal(wire, decoded); err != nil {
		t.Fatal(err)
	}
	got := status.FromProto(decoded)
	if got.Code() != codes.Aborted || len(got.Details()) != 1 {
		t.Fatalf("unexpected decoded status: %v", got)
	}
	detail, ok := got.Details()[0].(*ErrorResult)
	if !ok || !proto.Equal(want, detail) {
		t.Fatalf("ErrorResult status details did not round-trip: %v", got.Details())
	}
}

func TestSearchResultContract(t *testing.T) {
	request := (&ResourceSearchRequest{}).ProtoReflect().Descriptor()
	response := (&ResourceSearchResponse{}).ProtoReflect().Descriptor()
	if response.Fields().ByNumber(3) != nil || !response.ReservedRanges().Has(3) || !response.ReservedNames().Has("results") {
		t.Fatal("the retired results field name and number must stay reserved")
	}
	for _, test := range []struct {
		message protoreflect.MessageDescriptor
		number  protoreflect.FieldNumber
	}{
		{message: request, number: 16},
		{message: response, number: 10},
	} {
		field := test.message.Fields().ByName("result_format")
		if field == nil || field.Number() != test.number {
			t.Errorf("%s must keep result_format at field %d", test.message.Name(), test.number)
		}
	}
	if ResourceSearchRequest_UNSPECIFIED != 0 || ResourceSearchRequest_RESOURCE_TABLE != 1 || ResourceSearchRequest_FIELD_VALUES != 2 {
		t.Fatal("result format wire values must not change")
	}
	for _, name := range []protoreflect.Name{"ResourceTable", "ResourceTableColumnDefinition", "ResourceTableRow"} {
		if File_resource_proto.Messages().ByName(name) != nil {
			t.Errorf("retired message %s must not be part of the resource contract", name)
		}
	}
}

func TestSearchResponseIgnoresRetiredTableField(t *testing.T) {
	const rv = int64(9007199254740993)
	want := &ResourceSearchResponse{
		ResultFormat: ResourceSearchRequest_FIELD_VALUES,
		Fields: []*ResourceSearchField{
			{Name: "count", Type: ResourceSearchField_INT64},
			{Name: "enabled", Type: ResourceSearchField_BOOLEAN},
		},
		Rows: []*ResourceSearchRow{{
			Key:             &ResourceKey{Name: "typed-result"},
			ResourceVersion: rv,
			SortFields:      []string{"typed-result"},
			Values: []*ResourceSearchValue{
				{FieldIndex: 0, Int64Values: []int64{rv}},
				{FieldIndex: 1, BooleanValues: []bool{false}},
			},
		}},
	}
	payload, err := proto.Marshal(want)
	if err != nil {
		t.Fatal(err)
	}
	// An empty legacy table is a valid payload for the retired field.
	payload = protowire.AppendTag(payload, 3, protowire.BytesType)
	payload = protowire.AppendBytes(payload, nil)
	var got ResourceSearchResponse
	if err := proto.Unmarshal(payload, &got); err != nil {
		t.Fatal(err)
	}
	got.ProtoReflect().SetUnknown(nil)
	if !proto.Equal(want, &got) {
		t.Fatalf("ignoring the retired field must preserve typed results: got %v, want %v", &got, want)
	}
}
