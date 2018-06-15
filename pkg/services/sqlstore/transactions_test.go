package sqlstore

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/grafana/pkg/models"

	. "github.com/smartystreets/goconvey/convey"
)

type testQuery struct {
	result bool
}

var ProvokedError = errors.New("testing error.")

func TestTransaction(t *testing.T) {
	ss := InitTestDB(t)

	Convey("InTransaction asdf asdf", t, func() {
		cmd := &models.AddApiKeyCommand{Key: "secret-key", Name: "key", OrgId: 1}

		err := AddApiKey(cmd)
		So(err, ShouldBeNil)

		deleteApiKeyCmd := &models.DeleteApiKeyCommand{Id: cmd.Result.Id, OrgId: 1}

		Convey("can update key", func() {
			err := ss.InTransaction(context.Background(), func(ctx context.Context) error {
				return DeleteApiKeyCtx(ctx, deleteApiKeyCmd)
			})

			So(err, ShouldBeNil)

			query := &models.GetApiKeyByIdQuery{ApiKeyId: cmd.Result.Id}
			err = GetApiKeyById(query)
			So(err, ShouldEqual, models.ErrInvalidApiKey)
		})

		Convey("wont update if one handler fails", func() {
			err := ss.InTransaction(context.Background(), func(ctx context.Context) error {
				err := DeleteApiKeyCtx(ctx, deleteApiKeyCmd)
				if err != nil {
					return err
				}

				return ProvokedError
			})

			So(err, ShouldEqual, ProvokedError)

			query := &models.GetApiKeyByIdQuery{ApiKeyId: cmd.Result.Id}
			err = GetApiKeyById(query)
			So(err, ShouldBeNil)
			So(query.Result.Id, ShouldEqual, cmd.Result.Id)
		})
	})
}
