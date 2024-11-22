package legacy

import (
	"context"
	"fmt"
	"os"
	"path"
	"strings"
	"time"

	"github.com/go-git/go-git/v5"
	jsoniter "github.com/json-iterator/go"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type commitHelper struct {
	ctx           context.Context
	repo          *git.Repository
	work          *git.Worktree
	workDir       string // same as the worktree root
	orgDir        string
	orgID         int64
	stopRequested bool
	broadcast     func(path string)

	users   map[int64]*userInfo
	folders map[string]string // UID >> file path

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
			name:  "admin",
			email: "admin@unknown.org",
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

		err = os.WriteFile(b.fpath, body, 0644)
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

func firstRealStringX(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return "?"
}
