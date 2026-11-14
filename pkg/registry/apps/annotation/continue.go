package annotation

import (
	"encoding/base64"
	"fmt"
	"strconv"
	"strings"
)

var (
	errInvalidContinueToken  = fmt.Errorf("%w: invalid continue token", ErrInvalidInput)
	errContinueLimitMismatch = fmt.Errorf("%w: continue token limit does not match the request limit", ErrInvalidInput)
)

// continueToken holds the next offset and limit for list pagination.
// Token format: base64("offset/limit") so the limit can be validated across requests.
type continueToken struct {
	Offset int64
	Limit  int64
}

func decodeContinueToken(s string) (continueToken, error) {
	t := continueToken{}
	if s == "" {
		return t, nil
	}
	decoded, err := base64.StdEncoding.DecodeString(s)
	if err != nil {
		return t, errInvalidContinueToken
	}
	parts := strings.Split(string(decoded), "/")
	if len(parts) != 2 {
		return t, errInvalidContinueToken
	}
	t.Offset, err = strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		return t, errInvalidContinueToken
	}
	t.Limit, err = strconv.ParseInt(parts[1], 10, 64)
	if err != nil {
		return t, errInvalidContinueToken
	}
	if t.Offset < 0 || t.Limit <= 0 {
		return t, errInvalidContinueToken
	}
	return t, nil
}

func encodeContinueToken(offset, limit int64) string {
	data := fmt.Sprintf("%d/%d", offset, limit)
	return base64.StdEncoding.EncodeToString([]byte(data))
}
