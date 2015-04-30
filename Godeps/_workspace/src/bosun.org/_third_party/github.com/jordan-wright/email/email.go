// Package email is designed to provide an "email interface for humans."
// Designed to be robust and flexible, the email package aims to make sending email easy without getting in the way.
package email

import (
	"bytes"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net/mail"
	"net/smtp"
	"net/textproto"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	// MaxLineLength is the maximum line length per RFC 2045
	MaxLineLength = 76
)

// Email is the type used for email messages
type Email struct {
	From        string
	To          []string
	Bcc         []string
	Cc          []string
	Subject     string
	Text        []byte // Plaintext message (optional)
	HTML        []byte // Html message (optional)
	Headers     textproto.MIMEHeader
	Attachments []*Attachment
	ReadReceipt []string
}

// NewEmail creates an Email, and returns the pointer to it.
func NewEmail() *Email {
	return &Email{Headers: textproto.MIMEHeader{}}
}

// Attach is used to attach content from an io.Reader to the email.
// Required parameters include an io.Reader, the desired filename for the attachment, and the Content-Type
// The function will return the created Attachment for reference, as well as nil for the error, if successful.
func (e *Email) Attach(r io.Reader, filename string, c string) (a *Attachment, err error) {
	var buffer bytes.Buffer
	if _, err = io.Copy(&buffer, r); err != nil {
		return
	}
	at := &Attachment{
		Filename: filename,
		Header:   textproto.MIMEHeader{},
		Content:  buffer.Bytes(),
	}
	// Get the Content-Type to be used in the MIMEHeader
	if c != "" {
		at.Header.Set("Content-Type", c)
	} else {
		// If the Content-Type is blank, set the Content-Type to "application/octet-stream"
		at.Header.Set("Content-Type", "application/octet-stream")
	}
	at.Header.Set("Content-Disposition", fmt.Sprintf("attachment;\r\n filename=\"%s\"", filename))
	at.Header.Set("Content-ID", fmt.Sprintf("<%s>", filename))
	at.Header.Set("Content-Transfer-Encoding", "base64")
	e.Attachments = append(e.Attachments, at)
	return at, nil
}

// AttachFile is used to attach content to the email.
// It attempts to open the file referenced by filename and, if successful, creates an Attachment.
// This Attachment is then appended to the slice of Email.Attachments.
// The function will then return the Attachment for reference, as well as nil for the error, if successful.
func (e *Email) AttachFile(filename string) (a *Attachment, err error) {
	f, err := os.Open(filename)
	if err != nil {
		return
	}
	ct := mime.TypeByExtension(filepath.Ext(filename))
	basename := filepath.Base(filename)
	return e.Attach(f, basename, ct)
}

// msgHeaders merges the Email's various fields and custom headers together in a
// standards compliant way to create a MIMEHeader to be used in the resulting
// message. It does not alter e.Headers.
//
// "e"'s fields To, Cc, From, Subject will be used unless they are present in
// e.Headers. Unless set in e.Headers, "Date" will filled with the current time.
func (e *Email) msgHeaders() textproto.MIMEHeader {
	res := make(textproto.MIMEHeader, len(e.Headers)+4)
	if e.Headers != nil {
		for _, h := range []string{"To", "Cc", "From", "Subject", "Date"} {
			if v, ok := e.Headers[h]; ok {
				res[h] = v
			}
		}
	}
	// Set headers if there are values.
	if _, ok := res["To"]; !ok && len(e.To) > 0 {
		res.Set("To", strings.Join(e.To, ", "))
	}
	if _, ok := res["Cc"]; !ok && len(e.Cc) > 0 {
		res.Set("Cc", strings.Join(e.Cc, ", "))
	}
	if _, ok := res["Subject"]; !ok && e.Subject != "" {
		res.Set("Subject", e.Subject)
	}
	// Date and From are required headers.
	if _, ok := res["From"]; !ok {
		res.Set("From", e.From)
	}
	if _, ok := res["Date"]; !ok {
		res.Set("Date", time.Now().Format(time.RFC1123Z))
	}
	if _, ok := res["Mime-Version"]; !ok {
		res.Set("Mime-Version", "1.0")
	}
	for field, vals := range e.Headers {
		if _, ok := res[field]; !ok {
			res[field] = vals
		}
	}
	return res
}

// Bytes converts the Email object to a []byte representation, including all needed MIMEHeaders, boundaries, etc.
func (e *Email) Bytes() ([]byte, error) {
	// TODO: better guess buffer size
	buff := bytes.NewBuffer(make([]byte, 0, 4096))

	headers := e.msgHeaders()
	w := multipart.NewWriter(buff)
	// TODO: determine the content type based on message/attachment mix.
	headers.Set("Content-Type", "multipart/mixed;\r\n boundary="+w.Boundary())
	headerToBytes(buff, headers)
	io.WriteString(buff, "\r\n")

	// Start the multipart/mixed part
	fmt.Fprintf(buff, "--%s\r\n", w.Boundary())
	header := textproto.MIMEHeader{}
	// Check to see if there is a Text or HTML field
	if len(e.Text) > 0 || len(e.HTML) > 0 {
		subWriter := multipart.NewWriter(buff)
		// Create the multipart alternative part
		header.Set("Content-Type", fmt.Sprintf("multipart/alternative;\r\n boundary=%s\r\n", subWriter.Boundary()))
		// Write the header
		headerToBytes(buff, header)
		// Create the body sections
		if len(e.Text) > 0 {
			header.Set("Content-Type", fmt.Sprintf("text/plain; charset=UTF-8"))
			header.Set("Content-Transfer-Encoding", "quoted-printable")
			if _, err := subWriter.CreatePart(header); err != nil {
				return nil, err
			}
			// Write the text
			if err := quotePrintEncode(buff, e.Text); err != nil {
				return nil, err
			}
		}
		if len(e.HTML) > 0 {
			header.Set("Content-Type", fmt.Sprintf("text/html; charset=UTF-8"))
			header.Set("Content-Transfer-Encoding", "quoted-printable")
			if _, err := subWriter.CreatePart(header); err != nil {
				return nil, err
			}
			// Write the text
			if err := quotePrintEncode(buff, e.HTML); err != nil {
				return nil, err
			}
		}
		if err := subWriter.Close(); err != nil {
			return nil, err
		}
	}
	// Create attachment part, if necessary
	for _, a := range e.Attachments {
		ap, err := w.CreatePart(a.Header)
		if err != nil {
			return nil, err
		}
		// Write the base64Wrapped content to the part
		base64Wrap(ap, a.Content)
	}
	if err := w.Close(); err != nil {
		return nil, err
	}
	return buff.Bytes(), nil
}

// Send an email using the given host and SMTP auth (optional), returns any error thrown by smtp.SendMail
// This function merges the To, Cc, and Bcc fields and calls the smtp.SendMail function using the Email.Bytes() output as the message
func (e *Email) Send(addr string, a smtp.Auth) error {
	// Merge the To, Cc, and Bcc fields
	to := make([]string, 0, len(e.To)+len(e.Cc)+len(e.Bcc))
	to = append(append(append(to, e.To...), e.Cc...), e.Bcc...)
	for i := 0; i < len(to); i++ {
		addr, err := mail.ParseAddress(to[i])
		if err != nil {
			return err
		}
		to[i] = addr.Address
	}
	// Check to make sure there is at least one recipient and one "From" address
	if e.From == "" || len(to) == 0 {
		return errors.New("Must specify at least one From address and one To address")
	}
	from, err := mail.ParseAddress(e.From)
	if err != nil {
		return err
	}
	raw, err := e.Bytes()
	if err != nil {
		return err
	}
	return smtp.SendMail(addr, a, from.Address, to, raw)
}

// Attachment is a struct representing an email attachment.
// Based on the mime/multipart.FileHeader struct, Attachment contains the name, MIMEHeader, and content of the attachment in question
type Attachment struct {
	Filename string
	Header   textproto.MIMEHeader
	Content  []byte
}

// quotePrintEncode writes the quoted-printable text to the IO Writer (according to RFC 2045)
func quotePrintEncode(w io.Writer, body []byte) error {
	var buf [3]byte
	mc := 0
	for _, c := range body {
		// We're assuming Unix style text formats as input (LF line break), and
		// quoted-printable uses CRLF line breaks. (Literal CRs will become
		// "=0D", but probably shouldn't be there to begin with!)
		if c == '\n' {
			io.WriteString(w, "\r\n")
			mc = 0
			continue
		}

		var nextOut []byte
		if isPrintable[c] {
			buf[0] = c
			nextOut = buf[:1]
		} else {
			nextOut = buf[:]
			qpEscape(nextOut, c)
		}

		// Add a soft line break if the next (encoded) byte would push this line
		// to or past the limit.
		if mc+len(nextOut) >= MaxLineLength {
			if _, err := io.WriteString(w, "=\r\n"); err != nil {
				return err
			}
			mc = 0
		}

		if _, err := w.Write(nextOut); err != nil {
			return err
		}
		mc += len(nextOut)
	}
	// No trailing end-of-line?? Soft line break, then. TODO: is this sane?
	if mc > 0 {
		io.WriteString(w, "=\r\n")
	}
	return nil
}

// isPrintable holds true if the byte given is "printable" according to RFC 2045, false otherwise
var isPrintable [256]bool

func init() {
	for c := '!'; c <= '<'; c++ {
		isPrintable[c] = true
	}
	for c := '>'; c <= '~'; c++ {
		isPrintable[c] = true
	}
	isPrintable[' '] = true
	isPrintable['\n'] = true
	isPrintable['\t'] = true
}

// qpEscape is a helper function for quotePrintEncode which escapes a
// non-printable byte. Expects len(dest) == 3.
func qpEscape(dest []byte, c byte) {
	const nums = "0123456789ABCDEF"
	dest[0] = '='
	dest[1] = nums[(c&0xf0)>>4]
	dest[2] = nums[(c & 0xf)]
}

// base64Wrap encodes the attachment content, and wraps it according to RFC 2045 standards (every 76 chars)
// The output is then written to the specified io.Writer
func base64Wrap(w io.Writer, b []byte) {
	// 57 raw bytes per 76-byte base64 line.
	const maxRaw = 57
	// Buffer for each line, including trailing CRLF.
	buffer := make([]byte, MaxLineLength+len("\r\n"))
	copy(buffer[MaxLineLength:], "\r\n")
	// Process raw chunks until there's no longer enough to fill a line.
	for len(b) >= maxRaw {
		base64.StdEncoding.Encode(buffer, b[:maxRaw])
		w.Write(buffer)
		b = b[maxRaw:]
	}
	// Handle the last chunk of bytes.
	if len(b) > 0 {
		out := buffer[:base64.StdEncoding.EncodedLen(len(b))]
		base64.StdEncoding.Encode(out, b)
		out = append(out, "\r\n"...)
		w.Write(out)
	}
}

// headerToBytes renders "header" to "buff". If there are multiple values for a
// field, multiple "Field: value\r\n" lines will be emitted.
func headerToBytes(buff *bytes.Buffer, header textproto.MIMEHeader) {
	for field, vals := range header {
		for _, subval := range vals {
			// bytes.Buffer.Write() never returns an error.
			io.WriteString(buff, field)
			io.WriteString(buff, ": ")
			io.WriteString(buff, subval)
			io.WriteString(buff, "\r\n")
		}
	}
}
