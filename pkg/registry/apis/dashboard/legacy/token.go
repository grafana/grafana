package legacy

import (
	"fmt"
	"strconv"
	"strings"
)

type continueToken struct {
	orgId  int64
	id     int64  // the internal id (sort by!)
	folder string // from the query
}

func readContinueToken(next string) (continueToken, error) {
	var err error
	token := continueToken{}
	if next == "" {
		return token, nil
	}
	parts := strings.Split(next, "/")
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
	if sub[0] != "start" {
		return token, fmt.Errorf("expected internal ID in second slug")
	}
	token.id, err = strconv.ParseInt(sub[1], 10, 64)
	if err != nil {
		return token, fmt.Errorf("error parsing updated")
	}

	sub = strings.Split(parts[2], ":")
	if sub[0] != "folder" {
		return token, fmt.Errorf("expected folder UID in third slug")
	}
	token.folder = sub[1]

	// // Check if the folder filter is the same from the previous query
	// if q.Requirements.Folder == nil {
	// 	if token.folder != "" {
	// 		return token, fmt.Errorf("invalid token, the folder must match previous query")
	// 	}
	// } else if token.folder != *q.Requirements.Folder {
	// 	return token, fmt.Errorf("invalid token, the folder must match previous query")
	// }

	return token, err
}

func (r *continueToken) String() string {
	return fmt.Sprintf("org:%d/start:%d/folder:%s",
		r.orgId, r.id, r.folder)
}
