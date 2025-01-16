package legacy

import (
	"database/sql"
	"time"

	"github.com/go-git/go-git/v5/plumbing/object"
)

type userInfo struct {
	name  string
	email string
	login string
}

func (u *userInfo) getAuthor() object.Signature {
	return object.Signature{
		Name:  firstRealStringX(u.name, u.login, u.email, "?"),
		Email: firstRealStringX(u.email, u.login, u.name, "?"),
		When:  time.Now(),
	}
}

type folderInfo struct {
	uid         string
	title       string
	description sql.NullString
	parent      sql.NullString
	update      time.Time
	updateBy    int64

	children []*folderInfo
}
