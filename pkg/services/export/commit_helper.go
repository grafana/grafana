package export

import (
	"context"
	"fmt"
	"io/ioutil"
	"os"
	"path"
	"strings"
	"time"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing/object"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	jsoniter "github.com/json-iterator/go"
)

type commitHelper struct {
	ctx           context.Context
	repo          *git.Repository
	work          *git.Worktree
	orgDir        string // includes the orgID
	workDir       string // same as the worktree root
	orgID         int64
	users         map[int64]*userInfo
	stopRequested bool
	broadcast     func(path string)
	exporter      string // key for the current exporter

	counter int
}

type commitBody struct {
	fpath string // absolute
	body  []byte
	frame *data.Frame
}

type commitOptions struct {
	body    []commitBody
	when    time.Time
	userID  int64
	comment string
}

func (ch *commitHelper) initOrg(sql *sqlstore.SQLStore, orgID int64) error {
	return sql.WithDbSession(ch.ctx, func(sess *sqlstore.DBSession) error {
		sess.Table("user").
			Join("inner", "org_user", "user.id = org_user.user_id").
			Cols("user.*", "org_user.role").
			Where("org_user.org_id = ?", orgID).
			Asc("user.id")

		rows := make([]*userInfo, 0)
		err := sess.Find(&rows)
		if err != nil {
			return err
		}

		lookup := make(map[int64]*userInfo, len(rows))
		for _, row := range rows {
			lookup[row.ID] = row
		}
		ch.users = lookup
		ch.orgID = orgID
		return err
	})
}

func (ch *commitHelper) add(opts commitOptions) error {
	if ch.stopRequested {
		return fmt.Errorf("stop requested")
	}

	if len(opts.body) < 1 {
		return nil // nothing to commit
	}

	user, ok := ch.users[opts.userID]
	if !ok {
		user = &userInfo{
			Name:  "admin",
			Email: "admin@unknown.org",
		}
	}
	sig := user.getAuthor()
	if opts.when.Unix() > 100 {
		sig.When = opts.when
	}

	for _, b := range opts.body {
		if !strings.HasPrefix(b.fpath, ch.orgDir) {
			return fmt.Errorf("invalid path, must be within the root folder")
		}

		// make sure the parent exists
		err := os.MkdirAll(path.Dir(b.fpath), 0750)
		if err != nil {
			return err
		}

		body := b.body
		if b.frame != nil {
			body, err = jsoniter.ConfigCompatibleWithStandardLibrary.MarshalIndent(b.frame, "", "  ")
			if err != nil {
				return err
			}
		}

		err = ioutil.WriteFile(b.fpath, body, 0644)
		if err != nil {
			return err
		}
		err = os.Chtimes(b.fpath, sig.When, sig.When)
		if err != nil {
			return err
		}

		sub := b.fpath[len(ch.workDir)+1:]
		_, err = ch.work.Add(sub)
		if err != nil {
			status, e2 := ch.work.Status()
			if e2 != nil {
				return fmt.Errorf("error adding: %s (invalud work status: %s)", sub, e2.Error())
			}
			fmt.Printf("STATUS: %+v\n", status)
			return fmt.Errorf("unable to add file: %s (%d)", sub, len(b.body))
		}
		ch.counter++
	}

	copts := &git.CommitOptions{
		Author: &sig,
	}

	ch.broadcast(opts.body[0].fpath)
	_, err := ch.work.Commit(opts.comment, copts)
	return err
}

type userInfo struct {
	ID               int64     `json:"-" xorm:"id"`
	Login            string    `json:"login"`
	Email            string    `json:"email"`
	Name             string    `json:"name"`
	Password         string    `json:"password"`
	Salt             string    `json:"salt"`
	Role             string    `json:"org_role"` // org role
	Theme            string    `json:"-"`        // managed in preferences
	Created          time.Time `json:"-"`        // managed in git or external source
	Updated          time.Time `json:"-"`        // managed in git or external source
	IsDisabled       bool      `json:"disabled" xorm:"is_disabled"`
	IsServiceAccount bool      `json:"serviceAccount" xorm:"is_service_account"`
	LastSeenAt       time.Time `json:"-" xorm:"last_seen_at"`
}

func (u *userInfo) getAuthor() object.Signature {
	return object.Signature{
		Name:  firstRealStringX(u.Name, u.Login, u.Email, "?"),
		Email: firstRealStringX(u.Email, u.Login, u.Name, "?"),
		When:  time.Now(),
	}
}

func firstRealStringX(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return "?"
}
