package sqlstash

import (
	"crypto/md5"
	"encoding/base64"
	"encoding/hex"
	"strings"

	"github.com/gosimple/slug"
)

func createContentsHash(contents []byte) string {
	hash := md5.Sum(contents)
	return hex.EncodeToString(hash[:])
}

func slugifyTitle(title string, fallback string) string {
	if title == "" {
		title = fallback
	}
	s := slug.Make(strings.ToLower(title))
	if s == "" {
		// If the dashboard name is only characters outside of the
		// sluggable characters, the slug creation will return an
		// empty string which will mess up URLs. This failsafe picks
		// that up and creates the slug as a base64 identifier instead.
		s = base64.RawURLEncoding.EncodeToString([]byte(title))
		if slug.MaxLength != 0 && len(s) > slug.MaxLength {
			s = s[:slug.MaxLength]
		}
	}
	return s
}
