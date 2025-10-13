package actest

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/require"
)

const Concurrency = 10
const BatchSize = 1000

type bounds struct {
	start, end int
}

// ConcurrentBatch spawns the requested amount of workers then ask them to run eachFn on chunks of the requested size
func ConcurrentBatch(workers, count, size int, eachFn func(start, end int) error) error {
	var wg sync.WaitGroup
	alldone := make(chan bool) // Indicates that all workers have finished working
	chunk := make(chan bounds) // Gives the workers the bounds they should work with
	ret := make(chan error)    // Allow workers to notify in case of errors
	defer close(ret)

	// Launch all workers
	for x := 0; x < workers; x++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for ck := range chunk {
				if err := eachFn(ck.start, ck.end); err != nil {
					ret <- err
					return
				}
			}
		}()
	}

	go func() {
		// Tell the workers the chunks they have to work on
		for i := 0; i < count; {
			end := i + size
			if end > count {
				end = count
			}

			chunk <- bounds{start: i, end: end}

			i = end
		}
		close(chunk)

		// Wait for the workers
		wg.Wait()
		close(alldone)
	}()

	// wait for an error or for all workers to be done
	select {
	case err := <-ret:
		return err
	case <-alldone:
		break
	}
	return nil
}

// creates a role, connected it to user and store all permission from the user in database
func AddUserPermissionToDB(t testing.TB, db db.DB, user *user.SignedInUser) {
	t.Helper()
	err := db.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		var oldRole accesscontrol.Role
		hadOldRole, err := sess.SQL("SELECT * FROM role where uid = 'test_role'").Get(&oldRole)
		if err != nil {
			return err
		}

		_, err = sess.Exec("DELETE FROM role WHERE uid = 'test_role'")
		require.NoError(t, err)

		role := &accesscontrol.Role{
			OrgID:   user.OrgID,
			UID:     "test_role",
			Name:    "test:role",
			Updated: time.Now(),
			Created: time.Now(),
		}

		if _, err := sess.Insert(role); err != nil {
			return err
		}

		_, err = sess.Insert(accesscontrol.UserRole{
			OrgID:   role.OrgID,
			RoleID:  role.ID,
			UserID:  user.UserID,
			Created: time.Now(),
		})
		require.NoError(t, err)

		if hadOldRole {
			if _, err := sess.Exec("DELETE FROM permission WHERE role_id = ?", oldRole.ID); err != nil {
				return err
			}
		}

		var permissions []accesscontrol.Permission
		for action, scopes := range user.Permissions[user.OrgID] {
			for _, scope := range scopes {
				p := accesscontrol.Permission{
					RoleID: role.ID, Action: action, Scope: scope, Created: time.Now(), Updated: time.Now(),
				}
				p.Kind, p.Attribute, p.Identifier = p.SplitScope()

				permissions = append(permissions, p)
			}
		}

		if _, err := sess.InsertMulti(&permissions); err != nil {
			return err
		}

		return nil
	})

	require.NoError(t, err)
}
