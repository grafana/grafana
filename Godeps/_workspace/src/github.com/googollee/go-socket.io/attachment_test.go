package socketio

import (
	"bytes"
	"encoding/json"
	"io"
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

type NoAttachment struct {
	I int `json:"i"`
}

type HaveAttachment struct {
	NoAttachment
	A *Attachment `json:"a"`
}

func TestEncodeAttachments(t *testing.T) {
	var input interface{}
	var target []io.Reader
	buf1 := bytes.NewBufferString("data1")
	buf2 := bytes.NewBufferString("data2")
	attachment1 := &Attachment{Data: buf1}
	attachment2 := &Attachment{Data: buf2}

	test := func() {
		attachment1.num = -1
		attachment2.num = -1
		attachments := encodeAttachments(input)
		if len(attachments)+len(target) > 0 {
			So(attachments, ShouldResemble, target)
		}
	}

	Convey("No attachment", t, func() {
		input = &NoAttachment{}
		target = nil

		test()
	})

	Convey("Many attachment", t, func() {
		input = &HaveAttachment{A: attachment1}
		target = []io.Reader{buf1}

		test()

		So(attachment1.num, ShouldEqual, 0)
	})

	Convey("Array of attachments", t, func() {
		input = [...]interface{}{HaveAttachment{A: attachment1}, &HaveAttachment{A: attachment2}}
		target = []io.Reader{buf1, buf2}

		test()

		So(attachment1.num, ShouldEqual, 0)
		So(attachment2.num, ShouldEqual, 1)
	})

	Convey("Slice of attachments", t, func() {
		input = []interface{}{HaveAttachment{A: attachment1}, &HaveAttachment{A: attachment2}}
		target = []io.Reader{buf1, buf2}

		test()

		So(attachment1.num, ShouldEqual, 0)
		So(attachment2.num, ShouldEqual, 1)
	})

	Convey("Map of attachments", t, func() {
		input = map[string]interface{}{"test": HaveAttachment{A: attachment1}, "testp": &HaveAttachment{A: attachment2}}

		attachment1.num = -1
		attachment2.num = -1
		attachments := encodeAttachments(input)

		So(attachment1.num, ShouldBeIn, []int{0, 1})
		switch attachment1.num {
		case 0:
			So(attachment2.num, ShouldEqual, 1)
			target = []io.Reader{buf1, buf2}
			So(attachments, ShouldResemble, target)
		case 1:
			So(attachment2.num, ShouldEqual, 0)
			target = []io.Reader{buf2, buf1}
			So(attachments, ShouldResemble, target)
		}
	})

	Convey("Encode attachment", t, func() {
		input = map[string]interface{}{"test": HaveAttachment{A: attachment1}}

		attachment1.num = -1
		encodeAttachments(input)

		b, err := json.Marshal(input)
		So(err, ShouldBeNil)
		So(string(b), ShouldEqual, `{"test":{"i":0,"a":{"_placeholder":true,"num":0}}}`)
	})

}

func TestDecodeAttachments(t *testing.T) {
	var input [][]byte
	var v interface{}
	buf1 := bytes.NewBuffer(nil)
	buf2 := bytes.NewBuffer(nil)
	var attachment1 *Attachment
	var attachment2 *Attachment

	test := func() {
		err := decodeAttachments(v, input)
		So(err, ShouldBeNil)
		if attachment1 != nil {
			So(buf1.String(), ShouldEqual, "data1")
		}
		if attachment2 != nil {
			So(buf2.String(), ShouldEqual, "data2")
		}
		buf1.Reset()
		buf2.Reset()
	}

	Convey("No attachment", t, func() {
		input = nil
		v = NoAttachment{}

		test()
	})

	Convey("Many attachment", t, func() {
		input = [][]byte{[]byte("data1")}
		attachment1 = &Attachment{Data: buf1}
		attachment1.num = 0
		v = HaveAttachment{A: attachment1}

		test()
	})

	Convey("Array of attachments", t, func() {
		input = [][]byte{[]byte("data1"), []byte("data2")}
		attachment1 = &Attachment{Data: buf1}
		attachment1.num = 0
		attachment2 = &Attachment{Data: buf2}
		attachment2.num = 1
		v = [...]interface{}{HaveAttachment{A: attachment1}, &HaveAttachment{A: attachment2}}

		test()
	})

	Convey("Slice of attachments", t, func() {
		input = [][]byte{[]byte("data1"), []byte("data2")}
		attachment1 = &Attachment{Data: buf1}
		attachment1.num = 0
		attachment2 = &Attachment{Data: buf2}
		attachment2.num = 1
		v = []interface{}{HaveAttachment{A: attachment1}, &HaveAttachment{A: attachment2}}

		test()
	})

	Convey("Map of attachments", t, func() {
		input = [][]byte{[]byte("data1"), []byte("data2")}
		attachment1 = &Attachment{Data: buf1}
		attachment1.num = 0
		attachment2 = &Attachment{Data: buf2}
		attachment2.num = 1
		v = map[string]interface{}{"test": HaveAttachment{A: attachment1}, "testp": &HaveAttachment{A: attachment2}}

		test()
	})

	Convey("Deocde json", t, func() {
		b := []byte(`{"i":0,"a":{"_placeholder":true,"num":2}}`)
		v := &HaveAttachment{}
		err := json.Unmarshal(b, &v)
		So(err, ShouldBeNil)
		So(v.A.num, ShouldEqual, 2)
	})
}
