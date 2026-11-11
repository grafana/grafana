package resourcepb

import (
	"testing"

	"google.golang.org/protobuf/encoding/protowire"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protoreflect"
)

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
