// +build integration

package sqlstore

import (
	"context"
	"errors"
	"testing"

	. "github.com/smartystreets/goconvey/convey"

	"github.com/grafana/grafana/pkg/models"
)

var ErrProvokedError = errors.New("testing error")

func TestTransaction(t *testing.T) {
	ss := InitTestDB(t)

	Convey("InTransaction", t, func() {
		cmd := &models.AddApiKeyCommand{Key: "secret-key", Name: "key", OrgId: 1}

		err := AddApiKey(cmd)
		So(err, ShouldBeNil)

		Convey("can update key", func() {
			err := ss.WithTransactionalDbSession(context.Background(), func(sess *DBSession) error {
				return deleteAPIKey(sess, cmd.Result.Id, 1)
			})

			So(err, ShouldBeNil)

			query := &models.GetApiKeyByIdQuery{ApiKeyId: cmd.Result.Id}
			err = GetApiKeyById(query)
			So(err, ShouldEqual, models.ErrInvalidApiKey)
		})

		Convey("won't update if one handler fails", func() {
			err := ss.WithTransactionalDbSession(context.Background(), func(sess *DBSession) error {
				err := deleteAPIKey(sess, cmd.Result.Id, 1)
				if err != nil {
					return err
				}

				return ErrProvokedError
			})

			So(err, ShouldEqual, ErrProvokedError)

			query := &models.GetApiKeyByIdQuery{ApiKeyId: cmd.Result.Id}
			err = GetApiKeyById(query)
			So(err, ShouldBeNil)
			So(query.Result.Id, ShouldEqual, cmd.Result.Id)
		})
	})
}
