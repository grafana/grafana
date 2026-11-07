package sqldriver

import (
	"testing"

	dbproxyv1 "github.com/grafana/grafana/pkg/storage/dbproxy/api/dbproxy/v1"
	"google.golang.org/protobuf/types/known/structpb"
)

func TestPresentEmptyBytesRemainDistinctFromSQLNull(t *testing.T) {
	column := &dbproxyv1.Column{ValueType: dbproxyv1.ValueType_VALUE_TYPE_BYTES}
	present := &dbproxyv1.Value{Kind: &dbproxyv1.Value_BytesValue{BytesValue: nil}}
	value, err := resultValue(present, column)
	if err != nil {
		t.Fatal(err)
	}
	bytes, ok := value.([]byte)
	if !ok || bytes == nil || len(bytes) != 0 {
		t.Fatalf("present empty bytes = %#v", value)
	}

	null := &dbproxyv1.Value{Kind: &dbproxyv1.Value_NullValue{NullValue: structpb.NullValue_NULL_VALUE}}
	value, err = resultValue(null, column)
	if err != nil {
		t.Fatal(err)
	}
	if value != nil {
		t.Fatalf("SQL NULL = %#v", value)
	}
}
