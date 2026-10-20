package search

import (
	"encoding/base64"
	"errors"
	"strconv"
)

var errInvalidCursor = errors.New("invalid continue token")

// encodeCursor builds the continue token for the next page.
//
// The offset is encoded rather than sent as a plain integer to keep the token
// opaque, so clients cannot construct one or come to depend on its format. That
// leaves it free to carry a real cursor once pagination moves into the database.
func encodeCursor(offset int64) string {
	return base64.RawURLEncoding.EncodeToString([]byte(strconv.FormatInt(offset, 10)))
}

// decodeCursor reads a continue token, returning the offset to resume from. An
// empty token starts from the beginning.
func decodeCursor(token string) (int64, error) {
	if token == "" {
		return 0, nil
	}
	b, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil {
		return 0, errInvalidCursor
	}
	offset, err := strconv.ParseInt(string(b), 10, 64)
	// A token is only issued for a page that follows at least one row, so a
	// non-positive offset is forged or corrupt rather than one this API produced.
	if err != nil || offset <= 0 {
		return 0, errInvalidCursor
	}
	return offset, nil
}
