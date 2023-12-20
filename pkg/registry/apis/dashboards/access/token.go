package access

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/util"
)

type continueToken struct {
	orgId   int64
	updated int64
	uid     string
	row     int
	size    int64
}

func readContinueToken(t string) (continueToken, error) {
	var err error
	token := continueToken{}
	if t == "" {
		return token, nil
	}
	parts := strings.Split(t, "/")
	if len(parts) < 3 {
		return token, fmt.Errorf("invalid continue token (too few parts)")
	}
	sub := strings.Split(parts[0], ":")
	if sub[0] != "org" {
		return token, fmt.Errorf("expected org in first slug")
	}
	token.orgId, err = strconv.ParseInt(sub[1], 10, 64)
	if err != nil {
		return token, fmt.Errorf("error parsing orgid")
	}

	sub = strings.Split(parts[1], ":")
	if sub[0] != "updated" {
		return token, fmt.Errorf("expected updated in second slug")
	}
	token.updated, err = strconv.ParseInt(sub[1], 10, 64)
	if err != nil {
		return token, fmt.Errorf("error parsing updated")
	}

	sub = strings.Split(parts[2], ":")
	if sub[0] != "uid" {
		return token, fmt.Errorf("expected uid in third slug")
	}
	token.uid = sub[1]

	return token, err
}

func (r *continueToken) String() string {
	return fmt.Sprintf("org:%d/updated:%d/uid:%s/row:%d/%s",
		r.orgId, r.updated, r.uid, r.row, util.ByteCountSI(r.size))
}
