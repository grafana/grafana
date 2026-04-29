package annotation

import (
	"encoding/base64"
	"fmt"
	"strconv"
	"strings"
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
		return t, fmt.Errorf("invalid continue token")
	}
	parts := strings.Split(string(decoded), "/")
	if len(parts) != 2 {
		return t, fmt.Errorf("invalid continue token")
	}
	t.Offset, err = strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		return t, fmt.Errorf("invalid continue token (offset)")
	}
	t.Limit, err = strconv.ParseInt(parts[1], 10, 64)
	if err != nil {
		return t, fmt.Errorf("invalid continue token (limit)")
	}
	if t.Offset < 0 || t.Limit <= 0 {
		return t, fmt.Errorf("invalid continue token")
	}
	return t, nil
}

func encodeContinueToken(offset, limit int64) string {
	data := fmt.Sprintf("%d/%d", offset, limit)
	return base64.StdEncoding.EncodeToString([]byte(data))
}
