package folders

import (
	"encoding/base64"
	"fmt"
	"strconv"
	"strings"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
)

type continueToken struct {
	page  int64
	limit int64
}

const defaultPageLimit = 100
const defaultPageNumber = 1

func readContinueToken(options *internalversion.ListOptions) (*continueToken, error) {
	t := &continueToken{
		limit: defaultPageLimit,  // default page size
		page:  defaultPageNumber, // default page number
	}
	if options.Continue == "" {
		if options.Limit > 0 {
			t.limit = options.Limit
		}
	} else {
		continueVal, err := base64.StdEncoding.DecodeString(options.Continue)
		if err != nil {
			return nil, fmt.Errorf("error decoding continue token")
		}
		parts := strings.Split(string(continueVal), "|")
		if len(parts) != 2 {
			return nil, fmt.Errorf("error decoding continue token (expected two parts)")
		}

		t.page, err = strconv.ParseInt(parts[1], 10, 64)
		if err != nil {
			return nil, err
		}
		t.limit, err = strconv.ParseInt(parts[0], 10, 64)
		if err != nil {
			return nil, err
		}
		if options.Limit > 0 && options.Limit != t.limit {
			return nil, fmt.Errorf("limit does not match continue token")
		}
	}

	return t, nil
}

func (t *continueToken) GetNextPageToken() string {
	return base64.StdEncoding.EncodeToString([]byte(fmt.Sprintf("%d|%d", t.limit, t.page+1)))
}
