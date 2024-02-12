package helper

import (
	"github.com/grafana/grafana-plugin-sdk-go/data"
	jsoniter "github.com/json-iterator/go"
)

type JSONQueryBuilder[T any] interface {
	Start() error
	SetProp(prop string, iter *jsoniter.Iterator) error
	Finish() (T, error)
}

type QueryTypeRegistryX [T]struct {
	discriminator string // queryType
	types         map[string]JSONQueryBuilder[T]
}

func readDataFrameJSON(frame *data.Frame, iter *jsoniter.Iterator) error {
	for l1Field := iter.ReadObject(); l1Field != ""; l1Field = iter.ReadObject() {
		// switch l1Field {
		// case jsonKeySchema:
		// 	schema := frameSchema{}
		// 	iter.ReadVal(&schema)
		// 	frame.Name = schema.Name
		// 	frame.RefID = schema.RefID
		// 	frame.Meta = schema.Meta

		// 	// Create a new field for each object
		// 	for _, f := range schema.Fields {
		// 		ft := f.TypeInfo.Frame
		// 		if f.TypeInfo.Nullable {
		// 			ft = ft.NullableType()
		// 		}
		// 		tmp := NewFieldFromFieldType(ft, 0)
		// 		tmp.Name = f.Name
		// 		tmp.Labels = f.Labels
		// 		tmp.Config = f.Config
		// 		frame.Fields = append(frame.Fields, tmp)
		// 	}

		// case jsonKeyData:
		// 	err := readFrameData(iter, frame)
		// 	if err != nil {
		// 		return err
		// 	}

		// default:
		// 	iter.ReportError("bind l1", "unexpected field: "+l1Field)
		// }
	}
	return iter.Error
}
