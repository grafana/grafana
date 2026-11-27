package notifications

import (
	"bytes"
	"context"
	"errors"
	"io"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	gomail "gopkg.in/mail.v2"

	"github.com/grafana/grafana/pkg/setting"
)

type panickingWriter struct{}

func (panickingWriter) Write([]byte) (int, error) {
	var w io.Writer
	return w.Write(nil)
}

type stubWriter struct {
	written []byte
}

func (s *stubWriter) Write(p []byte) (int, error) {
	s.written = append(s.written, p...)
	return len(p), nil
}

type errWriter struct{}

var errBoom = errors.New("boom")

func (errWriter) Write([]byte) (int, error) { return 0, errBoom }

func TestWriteAttachmentRecoversFromWriterPanic(t *testing.T) {
	fn := writeAttachment("screenshot.png", []byte("payload"))

	require.NotPanics(t, func() {
		err := fn(panickingWriter{})
		require.Error(t, err)
		require.Contains(t, err.Error(), `panic while writing email attachment "screenshot.png"`)
	})
}

func TestWriteAttachmentWritesContent(t *testing.T) {
	w := &stubWriter{}
	require.NoError(t, writeAttachment("ok.png", []byte("payload"))(w))
	require.Equal(t, "payload", string(w.written))
}

func TestWriteAttachmentPropagatesWriteError(t *testing.T) {
	err := writeAttachment("err.png", []byte("payload"))(errWriter{})
	require.ErrorIs(t, err, errBoom)
	require.NotContains(t, err.Error(), "panic")
}

type recordingSender struct {
	closed bool
	panic  bool
}

func (s *recordingSender) Send(string, []string, io.WriterTo) error {
	if s.panic {
		panic("encode")
	}
	return nil
}

func (s *recordingSender) Close() error {
	s.closed = true
	return nil
}

func mailWithRecipient() *gomail.Message {
	m := gomail.NewMessage()
	m.SetHeader("From", "grafana@example.com")
	m.SetHeader("To", "to@example.com")
	m.SetBody("text/plain", "alert")
	return m
}

func TestSendAndCloseClosesWhenSendPanics(t *testing.T) {
	sender := &recordingSender{panic: true}
	require.Panics(t, func() {
		_ = sendAndClose(sender, mailWithRecipient())
	})
	require.True(t, sender.closed)
}

func TestSendAndCloseClosesAfterSend(t *testing.T) {
	sender := &recordingSender{}
	require.NoError(t, sendAndClose(sender, mailWithRecipient()))
	require.True(t, sender.closed)
}

func TestBuildMailWithScreenshotDoesNotPanic(t *testing.T) {
	sc := newTestSmtpClient(t, setting.NewCfg())
	png := bytes.Repeat([]byte{0x89, 0x50, 0x4e, 0x47}, 4096)
	msg := &Message{
		To:           []string{"to@address.com"},
		From:         "grafana@example.com",
		Subject:      "alert",
		ContentTypes: []string{"text/plain", "text/html"},
		Body: map[string]string{
			"text/plain": "alert fired",
			"text/html":  `<img src="cid:panel.png"/>`,
		},
		EmbeddedContents: []EmbeddedContent{{Name: "panel.png", Content: png}},
		AttachedFiles:    []*AttachedFile{{Name: "panel.png", Content: png}},
	}

	buf := new(bytes.Buffer)
	_, err := sc.buildEmail(context.Background(), setting.SmtpSettings{}, msg).WriteTo(buf)
	require.NoError(t, err)
	raw := buf.String()
	require.Contains(t, raw, `filename="panel.png"`)
	require.Contains(t, raw, "alert fired")
	require.False(t, strings.Contains(raw, "panic while writing"))
}
