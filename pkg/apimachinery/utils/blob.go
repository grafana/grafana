package utils

import (
	"bytes"
	"fmt"
	"mime"
	"strconv"
	"strings"
)

type BlobInfo struct {
	UID      string `json:"uid"`
	Size     int64  `json:"size,omitempty"`
	Hash     string `json:"hash,omitempty"`
	MimeType string `json:"mime,omitempty"`
	Charset  string `json:"charset,omitempty"` // content type = mime+charset
}

// Content type is mime + charset
func (b *BlobInfo) SetContentType(v string) {
	var params map[string]string
	var err error

	b.Charset = ""
	b.MimeType, params, err = mime.ParseMediaType(v)
	if err != nil {
		return
	}
	b.Charset = params["charset"]
}

// Content type is mime + charset
func (b *BlobInfo) ContentType() string {
	sb := bytes.NewBufferString(b.MimeType)
	if b.Charset != "" {
		sb.WriteString("; charset=")
		sb.WriteString(b.Charset)
	}
	return sb.String()
}

func (b *BlobInfo) String() string {
	sb := bytes.NewBufferString(b.UID)
	if b.Size > 0 {
		fmt.Fprintf(sb, "; size=%d", b.Size)
	}
	if b.Hash != "" {
		sb.WriteString("; hash=")
		sb.WriteString(b.Hash)
	}
	if b.MimeType != "" {
		sb.WriteString("; mime=")
		sb.WriteString(b.MimeType)
	}
	if b.Charset != "" {
		sb.WriteString("; charset=")
		sb.WriteString(b.Charset)
	}
	return sb.String()
}

func ParseBlobInfo(v string) *BlobInfo {
	if v == "" {
		return nil
	}
	info := &BlobInfo{}
	for i, part := range strings.Split(v, ";") {
		if i == 0 {
			info.UID = part
			continue
		}
		kv := strings.Split(strings.TrimSpace(part), "=")
		if len(kv) == 2 {
			val := kv[1]
			switch kv[0] {
			case "size":
				info.Size, _ = strconv.ParseInt(val, 10, 64)
			case "hash":
				info.Hash = val
			case "mime":
				info.MimeType = val
			case "charset":
				info.Charset = val
			}
		}
	}
	return info
}
