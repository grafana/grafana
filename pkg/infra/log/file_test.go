package log

import (
	"os"
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func (w *FileLogWriter) WriteLine(line string) error {
	n, err := w.mw.Write([]byte(line))
	if err != nil {
		return err
	}
	w.docheck(n)
	return nil
}

func TestLogFile(t *testing.T) {

	Convey("When logging to file", t, func() {
		fileLogWrite := NewFileWriter()
		So(fileLogWrite, ShouldNotBeNil)

		fileLogWrite.Filename = "grafana_test.log"
		err := fileLogWrite.Init()
		So(err, ShouldBeNil)

		Convey("Log file is empty", func() {
			So(fileLogWrite.maxlines_curlines, ShouldEqual, 0)
		})

		Convey("Logging should add lines", func() {
			err := fileLogWrite.WriteLine("test1\n")
			So(err, ShouldBeNil)
			err = fileLogWrite.WriteLine("test2\n")
			So(err, ShouldBeNil)
			err = fileLogWrite.WriteLine("test3\n")
			So(err, ShouldBeNil)
			So(fileLogWrite.maxlines_curlines, ShouldEqual, 3)
		})

		fileLogWrite.Close()
		err = os.Remove(fileLogWrite.Filename)
		So(err, ShouldBeNil)
	})
}
