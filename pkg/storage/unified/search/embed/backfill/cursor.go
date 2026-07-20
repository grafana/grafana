package backfill

import (
	"encoding/json"
	"fmt"
)

// jobCursor is the parsed form of vector_backfill_jobs.last_seen_key. It
// pins a continuation token to the Builder it was captured against so a
// pod restart resumes the correct builder rather than feeding a folders
// token to the dashboards iterator (or vice-versa).
//
// On-disk encoding is JSON: {"r":"<resource>","t":"<continue token>"}.
// Empty string in last_seen_key decodes to the zero cursor (meaning
// "start fresh from the first builder").
type jobCursor struct {
	Resource string `json:"r"`
	Token    string `json:"t"`
}

// encodeCursor produces the JSON form persisted in last_seen_key. Returns
// the empty string when both fields are zero so the column reads as
// "no cursor" rather than "{\"r\":\"\",\"t\":\"\"}".
func encodeCursor(resource, token string) string {
	if resource == "" && token == "" {
		return ""
	}
	b, err := json.Marshal(jobCursor{Resource: resource, Token: token})
	if err != nil {
		// json.Marshal of a struct of two strings can't fail; treat any
		// future surprise as "no cursor" rather than crashing the loop.
		return ""
	}
	return string(b)
}

// decodeCursor parses a stored last_seen_key. Empty input returns the
// zero cursor (Resource and Token both ""). Malformed input returns an
// error so the caller can decide whether to ignore (start fresh) or
// surface it.
func decodeCursor(s string) (jobCursor, error) {
	if s == "" {
		return jobCursor{}, nil
	}
	var c jobCursor
	if err := json.Unmarshal([]byte(s), &c); err != nil {
		return jobCursor{}, fmt.Errorf("decode cursor %q: %w", s, err)
	}
	return c, nil
}
