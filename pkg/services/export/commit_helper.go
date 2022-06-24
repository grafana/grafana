package export

import (
	"context"
	"io/ioutil"
	"time"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing/object"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type commitHelper struct {
	ctx     context.Context
	repo    *git.Repository
	work    *git.Worktree
	baseDir string
	orgID   int64
	users   map[int64]*userInfo
}

type commitOptions struct {
	fpath   string
	body    []byte
	when    time.Time
	userID  int64
	comment string
}

func (ch *commitHelper) initOrg(sql *sqlstore.SQLStore, orgID int64) error {
	return sql.WithDbSession(ch.ctx, func(sess *sqlstore.DBSession) error {
		sess.Table("user").Where("org_id = ?", orgID)

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
	err := ioutil.WriteFile(opts.fpath, opts.body, 0644)
	if err != nil {
		return err
	}

	_, err = ch.work.Add(opts.fpath)
	if err != nil {
		return err
	}

	user, ok := ch.users[opts.userID]
	if !ok {
		user = &userInfo{
			Name:  "admin",
			Email: "admin@unknown.org",
		}
	}
	sig := user.getAuthor()
	sig.When = opts.when

	copts := &git.CommitOptions{
		Author: &sig,
	}

	_, err = ch.work.Commit(opts.comment, copts)
	return err
}

type userInfo struct {
	ID               int64     `json:"-" xorm:"id"`
	Login            string    `json:"login"`
	Email            string    `json:"email"`
	Name             string    `json:"name"`
	Password         string    `json:"password"`
	Salt             string    `json:"-"`
	Theme            string    `json:"-"`
	Created          time.Time `json:"-"`
	Updated          time.Time `json:"-"`
	IsDisabled       bool      `json:"-" xorm:"is_disabled"`
	IsServiceAccount bool      `json:"-" xorm:"is_service_account"`
	LastSeenAt       time.Time `json:"-" xorm:"last_seen_at"`
}

func (u *userInfo) getAuthor() object.Signature {
	return object.Signature{
		Name:  firstRealStringX(u.Name, u.Login, u.Email, "?"),
		Email: firstRealStringX(u.Email, u.Login, u.Name, "?"),
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
