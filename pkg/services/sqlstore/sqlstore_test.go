package sqlstore

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/org"
)

func TestMain(m *testing.M) {
	SetupTestDB()
	code := m.Run()
	CleanupTestDB()
	os.Exit(code)
}

func TestIntegrationIsUniqueConstraintViolation(t *testing.T) {
	store, _ := InitTestDB(t)

	testCases := []struct {
		desc string
		f    func(*testing.T, *DBSession) error
	}{
		{
			desc: "successfully detect primary key violations",
			f: func(t *testing.T, sess *DBSession) error {
				// Attempt to insert org with provided ID (primary key) twice
				now := time.Now()
				org := org.Org{Name: "test org primary key violation", Created: now, Updated: now, ID: 42}
				err := sess.InsertId(&org, store.dialect)
				require.NoError(t, err)

				// Provide a different name to avoid unique constraint violation
				org.Name = "test org 2"
				return sess.InsertId(&org, store.dialect)
			},
		},
		{
			desc: "successfully detect unique constrain violations",
			f: func(t *testing.T, sess *DBSession) error {
				// Attempt to insert org with reserved name
				now := time.Now()
				org := org.Org{Name: "test org unique constrain violation", Created: now, Updated: now, ID: 43}
				err := sess.InsertId(&org, store.dialect)
				require.NoError(t, err)

				// Provide a different ID to avoid primary key violation
				org.ID = 44
				return sess.InsertId(&org, store.dialect)
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			err := store.WithDbSession(context.Background(), func(sess *DBSession) error {
				return tc.f(t, sess)
			})
			require.Error(t, err)
			assert.True(t, store.dialect.IsUniqueConstraintViolation(err))
		})
	}
}
