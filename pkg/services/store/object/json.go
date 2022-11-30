package object

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"unsafe"

	jsoniter "github.com/json-iterator/go"
)

func init() { //nolint:gochecknoinits
	jsoniter.RegisterTypeEncoder("object.ObjectSearchResult", &searchResultCodec{})
	jsoniter.RegisterTypeEncoder("object.WriteObjectResponse", &writeResponseCodec{})
	jsoniter.RegisterTypeEncoder("object.ReadObjectResponse", &readResponseCodec{})

	jsoniter.RegisterTypeEncoder("object.RawObject", &rawObjectCodec{})
	jsoniter.RegisterTypeDecoder("object.RawObject", &rawObjectCodec{})
}

func writeRawJson(stream *jsoniter.Stream, val []byte) {
	if json.Valid(val) {
		_, _ = stream.Write(val)
	} else {
		stream.WriteString(string(val))
	}
}

// Unlike the standard JSON marshal, this will write bytes as JSON when it can
type rawObjectCodec struct{}

func (obj *RawObject) MarshalJSON() ([]byte, error) {
	var json = jsoniter.ConfigCompatibleWithStandardLibrary
	return json.Marshal(obj)
}

// UnmarshalJSON will read JSON into a RawObject
func (obj *RawObject) UnmarshalJSON(b []byte) error {
	if obj == nil {
		return fmt.Errorf("unexpected nil for raw objcet")
	}
	iter := jsoniter.ParseBytes(jsoniter.ConfigDefault, b)
	readRawObject(iter, obj)
	return iter.Error
}

func (codec *rawObjectCodec) IsEmpty(ptr unsafe.Pointer) bool {
	f := (*RawObject)(ptr)
	return f.GRN == nil && f.Body == nil
}

func (codec *rawObjectCodec) Encode(ptr unsafe.Pointer, stream *jsoniter.Stream) {
	obj := (*RawObject)(ptr)
	stream.WriteObjectStart()
	stream.WriteObjectField("GRN")
	stream.WriteVal(obj.GRN)

	if obj.Version != "" {
		stream.WriteMore()
		stream.WriteObjectField("version")
		stream.WriteString(obj.Version)
	}
	if obj.CreatedAt > 0 {
		stream.WriteMore()
		stream.WriteObjectField("createdAt")
		stream.WriteInt64(obj.CreatedAt)
	}
	if obj.UpdatedAt > 0 {
		stream.WriteMore()
		stream.WriteObjectField("updatedAt")
		stream.WriteInt64(obj.UpdatedAt)
	}
	if obj.CreatedBy != "" {
		stream.WriteMore()
		stream.WriteObjectField("createdBy")
		stream.WriteString(obj.CreatedBy)
	}
	if obj.UpdatedBy != "" {
		stream.WriteMore()
		stream.WriteObjectField("updatedBy")
		stream.WriteString(obj.UpdatedBy)
	}
	if obj.Body != nil {
		stream.WriteMore()
		if json.Valid(obj.Body) {
			stream.WriteObjectField("body")
			stream.WriteRaw(string(obj.Body)) // works for strings
		} else {
			sEnc := base64.StdEncoding.EncodeToString(obj.Body)
			stream.WriteObjectField("body_base64")
			stream.WriteString(sEnc) // works for strings
		}
	}
	if obj.ETag != "" {
		stream.WriteMore()
		stream.WriteObjectField("etag")
		stream.WriteString(obj.ETag)
	}
	if obj.Folder != "" {
		stream.WriteMore()
		stream.WriteObjectField("folder")
		stream.WriteString(obj.Folder)
	}
	if obj.Slug != "" {
		stream.WriteMore()
		stream.WriteObjectField("slug")
		stream.WriteString(obj.Slug)
	}
	if obj.Size > 0 {
		stream.WriteMore()
		stream.WriteObjectField("size")
		stream.WriteInt64(obj.Size)
	}

	if obj.Origin != nil {
		stream.WriteMore()
		stream.WriteObjectField("origin")
		stream.WriteVal(obj.Origin)
	}

	stream.WriteObjectEnd()
}

func (codec *rawObjectCodec) Decode(ptr unsafe.Pointer, iter *jsoniter.Iterator) {
	*(*RawObject)(ptr) = RawObject{}
	raw := (*RawObject)(ptr)
	readRawObject(iter, raw)
}

func readRawObject(iter *jsoniter.Iterator, raw *RawObject) {
	for l1Field := iter.ReadObject(); l1Field != ""; l1Field = iter.ReadObject() {
		switch l1Field {
		case "GRN":
			raw.GRN = &GRN{}
			iter.ReadVal(raw.GRN)
		case "updatedAt":
			raw.UpdatedAt = iter.ReadInt64()
		case "updatedBy":
			raw.UpdatedBy = iter.ReadString()
		case "createdAt":
			raw.CreatedAt = iter.ReadInt64()
		case "createdBy":
			raw.CreatedBy = iter.ReadString()
		case "size":
			raw.Size = iter.ReadInt64()
		case "etag":
			raw.ETag = iter.ReadString()
		case "folder":
			raw.Folder = iter.ReadString()
		case "slug":
			raw.Slug = iter.ReadString()
		case "version":
			raw.Version = iter.ReadString()
		case "origin":
			raw.Origin = &ObjectOriginInfo{}
			iter.ReadVal(raw.Origin)

		case "body":
			var val interface{}
			iter.ReadVal(&val) // ??? is there a smarter way to just keep the underlying bytes without read+marshal
			body, err := json.Marshal(val)
			if err != nil {
				iter.ReportError("raw object", "error creating json from body")
				return
			}
			raw.Body = body

		case "body_base64":
			val := iter.ReadString()
			body, err := base64.StdEncoding.DecodeString(val)
			if err != nil {
				iter.ReportError("raw object", "error decoding base64 body")
				return
			}
			raw.Body = body

		default:
			iter.ReportError("raw object", "unexpected field: "+l1Field)
			return
		}
	}
}

// Unlike the standard JSON marshal, this will write bytes as JSON when it can
type readResponseCodec struct{}

func (obj *ReadObjectResponse) MarshalJSON() ([]byte, error) {
	var json = jsoniter.ConfigCompatibleWithStandardLibrary
	return json.Marshal(obj)
}

func (codec *readResponseCodec) IsEmpty(ptr unsafe.Pointer) bool {
	f := (*ReadObjectResponse)(ptr)
	return f == nil
}

func (codec *readResponseCodec) Encode(ptr unsafe.Pointer, stream *jsoniter.Stream) {
	obj := (*ReadObjectResponse)(ptr)
	stream.WriteObjectStart()
	stream.WriteObjectField("object")
	stream.WriteVal(obj.Object)

	if len(obj.SummaryJson) > 0 {
		stream.WriteMore()
		stream.WriteObjectField("summary")
		writeRawJson(stream, obj.SummaryJson)
	}

	stream.WriteObjectEnd()
}

// Unlike the standard JSON marshal, this will write bytes as JSON when it can
type searchResultCodec struct{}

func (obj *ObjectSearchResult) MarshalJSON() ([]byte, error) {
	var json = jsoniter.ConfigCompatibleWithStandardLibrary
	return json.Marshal(obj)
}

func (codec *searchResultCodec) IsEmpty(ptr unsafe.Pointer) bool {
	f := (*ObjectSearchResult)(ptr)
	return f.GRN == nil && f.Body == nil
}

func (codec *searchResultCodec) Encode(ptr unsafe.Pointer, stream *jsoniter.Stream) {
	obj := (*ObjectSearchResult)(ptr)
	stream.WriteObjectStart()
	stream.WriteObjectField("GRN")
	stream.WriteVal(obj.GRN)

	if obj.Name != "" {
		stream.WriteMore()
		stream.WriteObjectField("name")
		stream.WriteString(obj.Name)
	}
	if obj.Description != "" {
		stream.WriteMore()
		stream.WriteObjectField("description")
		stream.WriteString(obj.Description)
	}
	if obj.Size > 0 {
		stream.WriteMore()
		stream.WriteObjectField("size")
		stream.WriteInt64(obj.Size)
	}
	if obj.UpdatedAt > 0 {
		stream.WriteMore()
		stream.WriteObjectField("updatedAt")
		stream.WriteInt64(obj.UpdatedAt)
	}
	if obj.UpdatedBy != "" {
		stream.WriteMore()
		stream.WriteObjectField("updatedBy")
		stream.WriteVal(obj.UpdatedBy)
	}
	if obj.Body != nil {
		stream.WriteMore()
		if json.Valid(obj.Body) {
			stream.WriteObjectField("body")
			_, _ = stream.Write(obj.Body) // works for strings
		} else {
			stream.WriteObjectField("body_base64")
			stream.WriteVal(obj.Body) // works for strings
		}
	}
	if obj.Labels != nil {
		stream.WriteMore()
		stream.WriteObjectField("labels")
		stream.WriteVal(obj.Labels)
	}
	if obj.ErrorJson != nil {
		stream.WriteMore()
		stream.WriteObjectField("error")
		writeRawJson(stream, obj.ErrorJson)
	}
	if obj.FieldsJson != nil {
		stream.WriteMore()
		stream.WriteObjectField("fields")
		writeRawJson(stream, obj.FieldsJson)
	}

	stream.WriteObjectEnd()
}

// Unlike the standard JSON marshal, this will write bytes as JSON when it can
type writeResponseCodec struct{}

func (obj *WriteObjectResponse) MarshalJSON() ([]byte, error) {
	var json = jsoniter.ConfigCompatibleWithStandardLibrary
	return json.Marshal(obj)
}

func (codec *writeResponseCodec) IsEmpty(ptr unsafe.Pointer) bool {
	f := (*WriteObjectResponse)(ptr)
	return f == nil
}

func (codec *writeResponseCodec) Encode(ptr unsafe.Pointer, stream *jsoniter.Stream) {
	obj := (*WriteObjectResponse)(ptr)
	stream.WriteObjectStart()
	stream.WriteObjectField("status")
	stream.WriteString(obj.Status.String())

	if obj.Error != nil {
		stream.WriteMore()
		stream.WriteObjectField("error")
		stream.WriteVal(obj.Error)
	}
	if obj.GRN != nil {
		stream.WriteMore()
		stream.WriteObjectField("GRN")
		stream.WriteVal(obj.GRN)
	}
	if obj.Object != nil {
		stream.WriteMore()
		stream.WriteObjectField("object")
		stream.WriteVal(obj.Object)
	}
	if len(obj.SummaryJson) > 0 {
		stream.WriteMore()
		stream.WriteObjectField("summary")
		writeRawJson(stream, obj.SummaryJson)
	}
	stream.WriteObjectEnd()
}
