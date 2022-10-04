package object

import (
	"encoding/json"
	"unsafe"

	jsoniter "github.com/json-iterator/go"
)

func init() { //nolint:gochecknoinits
	//jsoniter.RegisterTypeEncoder("object.ReadObjectResponse", &readObjectResponseCodec{})
	jsoniter.RegisterTypeEncoder("object.RawObject", &rawObjectCodec{})
}

// Unlike the standard JSON marshal, this will write bytes as JSON when it can
type rawObjectCodec struct{}

// Custom marshal for RawObject (if JSON body)
func (obj *RawObject) MarshalJSON() ([]byte, error) {
	var json = jsoniter.ConfigCompatibleWithStandardLibrary
	return json.Marshal(obj)
}

func (codec *rawObjectCodec) IsEmpty(ptr unsafe.Pointer) bool {
	f := (*RawObject)(ptr)
	return f.UID == "" && f.Body == nil
}

func (codec *rawObjectCodec) Encode(ptr unsafe.Pointer, stream *jsoniter.Stream) {
	obj := (*RawObject)(ptr)
	stream.WriteObjectStart()
	stream.WriteObjectField("UID")
	stream.WriteString(obj.UID)

	if obj.Kind != "" {
		stream.WriteMore()
		stream.WriteObjectField("kind")
		stream.WriteString(obj.Kind)
	}
	if obj.Created > 0 {
		stream.WriteMore()
		stream.WriteObjectField("created")
		stream.WriteInt64(obj.Created)
	}
	if obj.CreatedBy != nil {
		stream.WriteMore()
		stream.WriteObjectField("createdBy")
		stream.WriteVal(obj.CreatedBy)
	}
	if obj.Modified > 0 {
		stream.WriteMore()
		stream.WriteObjectField("modified")
		stream.WriteInt64(obj.Modified)
	}
	if obj.ModifiedBy != nil {
		stream.WriteMore()
		stream.WriteObjectField("modifiedBy")
		stream.WriteVal(obj.ModifiedBy)
	}

	if obj.Size > 0 {
		stream.WriteMore()
		stream.WriteObjectField("size")
		stream.WriteInt64(obj.Size)
	}
	if obj.ETag != "" {
		stream.WriteMore()
		stream.WriteObjectField("etag")
		stream.WriteString(obj.ETag)
	}
	if obj.Version != "" {
		stream.WriteMore()
		stream.WriteObjectField("version")
		stream.WriteString(obj.Version)
	}

	// The one real difference (encodes JSON things directly)
	if obj.Body != nil {
		stream.WriteMore()
		stream.WriteObjectField("body")
		if json.Valid(obj.Body) {
			stream.WriteRaw(string(obj.Body)) // works for strings
		} else {
			stream.WriteString("// link to raw bytes //")
			//stream.WriteVal(obj.Body)
		}
	}

	if obj.SyncSrc != "" {
		stream.WriteMore()
		stream.WriteObjectField("syncSrc")
		stream.WriteString(obj.SyncSrc)
	}
	if obj.SyncTime > 0 {
		stream.WriteMore()
		stream.WriteObjectField("syncTime")
		stream.WriteInt64(obj.SyncTime)
	}

	stream.WriteObjectEnd()
}
