package socketio

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"reflect"
)

// Attachment is an attachment handler used in emit args. All attachments will send as binary in transport layer. When use attachment, make sure use as pointer.
//
// For example:
//
//     type Arg struct {
//         Title string `json:"title"`
//         File *Attachment `json:"file"`
//     }
//
//     f, _ := os.Open("./some_file")
//     arg := Arg{
//         Title: "some_file",
//         File: &Attachment{
//             Data: f,
//         }
//     }
//
//     socket.Emit("send file", arg)
//     socket.On("get file", func(so Socket, arg Arg) {
//         b, _ := ioutil.ReadAll(arg.File.Data)
//     })
type Attachment struct {

	// Data is the ReadWriter of the attachment data.
	Data io.ReadWriter
	num  int
}

func encodeAttachments(v interface{}) []io.Reader {
	index := 0
	return encodeAttachmentValue(reflect.ValueOf(v), &index)
}

func encodeAttachmentValue(v reflect.Value, index *int) []io.Reader {
	v = reflect.Indirect(v)
	ret := []io.Reader{}
	if !v.IsValid() {
		return ret
	}
	switch v.Kind() {
	case reflect.Struct:
		if v.Type().Name() == "Attachment" {
			a, ok := v.Addr().Interface().(*Attachment)
			if !ok {
				panic("can't convert")
			}
			a.num = *index
			ret = append(ret, a.Data)
			(*index)++
			return ret
		}
		for i, n := 0, v.NumField(); i < n; i++ {
			var r []io.Reader
			r = encodeAttachmentValue(v.Field(i), index)
			ret = append(ret, r...)
		}
	case reflect.Map:
		if v.IsNil() {
			return ret
		}
		for _, key := range v.MapKeys() {
			var r []io.Reader
			r = encodeAttachmentValue(v.MapIndex(key), index)
			ret = append(ret, r...)
		}
	case reflect.Slice:
		if v.IsNil() {
			return ret
		}
		fallthrough
	case reflect.Array:
		for i, n := 0, v.Len(); i < n; i++ {
			var r []io.Reader
			r = encodeAttachmentValue(v.Index(i), index)
			ret = append(ret, r...)
		}
	case reflect.Interface:
		ret = encodeAttachmentValue(reflect.ValueOf(v.Interface()), index)
	}
	return ret
}

func decodeAttachments(v interface{}, binary [][]byte) error {
	return decodeAttachmentValue(reflect.ValueOf(v), binary)
}

func decodeAttachmentValue(v reflect.Value, binary [][]byte) error {
	v = reflect.Indirect(v)
	if !v.IsValid() {
		return fmt.Errorf("invalid value")
	}
	switch v.Kind() {
	case reflect.Struct:
		if v.Type().Name() == "Attachment" {
			a, ok := v.Addr().Interface().(*Attachment)
			if !ok {
				panic("can't convert")
			}
			if a.num >= len(binary) || a.num < 0 {
				return fmt.Errorf("out of range")
			}
			if a.Data == nil {
				a.Data = bytes.NewBuffer(nil)
			}
			for b := binary[a.num]; len(b) > 0; {
				n, err := a.Data.Write(b)
				if err != nil {
					return err
				}
				b = b[n:]
			}
			return nil
		}
		for i, n := 0, v.NumField(); i < n; i++ {
			if err := decodeAttachmentValue(v.Field(i), binary); err != nil {
				return err
			}
		}
	case reflect.Map:
		if v.IsNil() {
			return nil
		}
		for _, key := range v.MapKeys() {
			if err := decodeAttachmentValue(v.MapIndex(key), binary); err != nil {
				return err
			}
		}
	case reflect.Slice:
		if v.IsNil() {
			return nil
		}
		fallthrough
	case reflect.Array:
		for i, n := 0, v.Len(); i < n; i++ {
			if err := decodeAttachmentValue(v.Index(i), binary); err != nil {
				return err
			}
		}
	case reflect.Interface:
		if err := decodeAttachmentValue(reflect.ValueOf(v.Interface()), binary); err != nil {
			return err
		}
	}
	return nil
}

func (a Attachment) MarshalJSON() ([]byte, error) {
	return []byte(fmt.Sprintf("{\"_placeholder\":true,\"num\":%d}", a.num)), nil
}

func (a *Attachment) UnmarshalJSON(b []byte) error {
	var v struct {
		Num int `json:"num"`
	}
	if err := json.Unmarshal(b, &v); err != nil {
		return err
	}
	a.num = v.Num
	return nil
}
