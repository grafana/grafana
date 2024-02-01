package api

import (
	"context"
	"errors"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
)

type ReceiverService interface {
	GetReceiver(ctx context.Context, q models.GetReceiverQuery, u identity.Requester) (definitions.GettableApiReceiver, error)
	GetReceivers(ctx context.Context, q models.GetReceiversQuery, u identity.Requester) ([]definitions.GettableApiReceiver, error)
}

type ReceiverSrv struct {
	logger          log.Logger
	receiverService ReceiverService
}

func (srv *ReceiverSrv) RouteGetReceiver(c *contextmodel.ReqContext, name string) response.Response {
	q := models.GetReceiverQuery{
		OrgID:   c.SignedInUser.OrgID,
		Name:    name,
		Decrypt: c.QueryBool("decrypt"),
	}

	receiver, err := srv.receiverService.GetReceiver(c.Req.Context(), q, c.SignedInUser)
	if err != nil {
		if errors.Is(err, notifier.ErrNotFound) {
			return ErrResp(http.StatusNotFound, err, "receiver not found")
		}
		if errors.Is(err, notifier.ErrPermissionDenied) {
			return ErrResp(http.StatusForbidden, err, "permission denied")
		}
		return ErrResp(http.StatusInternalServerError, err, "failed to get receiver")
	}

	return response.JSON(http.StatusOK, receiver)
}

func (srv *ReceiverSrv) RouteGetReceivers(c *contextmodel.ReqContext) response.Response {
	q := models.GetReceiversQuery{
		OrgID:   c.SignedInUser.OrgID,
		Names:   c.QueryStrings("names"),
		Limit:   c.QueryInt("limit"),
		Offset:  c.QueryInt("offset"),
		Decrypt: c.QueryBool("decrypt"),
	}

	receiverGroups, err := srv.receiverService.GetReceivers(c.Req.Context(), q, c.SignedInUser)
	if err != nil {
		if err == notifier.ErrPermissionDenied {
			return ErrResp(http.StatusForbidden, err, "permission denied")
		}
		return ErrResp(http.StatusInternalServerError, err, "failed to get receiver groups")
	}

	res := receiverGroups
	return response.JSON(http.StatusOK, res)
}
