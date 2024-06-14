package api

import (
	"context"
	"errors"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
)

type NotificationSrv struct {
	logger            log.Logger
	receiverService   ReceiverService
	muteTimingService MuteTimingService // defined in api_provisioning.go
}

type ReceiverService interface {
	GetReceiver(ctx context.Context, q models.GetReceiverQuery, u identity.Requester) (definitions.GettableApiReceiver, error)
	GetReceivers(ctx context.Context, q models.GetReceiversQuery, u identity.Requester) ([]definitions.GettableApiReceiver, error)
}

func (srv *NotificationSrv) RouteGetTimeInterval(c *contextmodel.ReqContext, name string) response.Response {
	muteTimeInterval, err := srv.muteTimingService.GetMuteTiming(c.Req.Context(), name, c.OrgID)
	if err != nil {
		return errorToResponse(err)
	}
	return response.JSON(http.StatusOK, muteTimeInterval) // TODO convert to timing interval
}

func (srv *NotificationSrv) RouteGetTimeIntervals(c *contextmodel.ReqContext) response.Response {
	muteTimeIntervals, err := srv.muteTimingService.GetMuteTimings(c.Req.Context(), c.OrgID)
	if err != nil {
		return errorToResponse(err)
	}
	return response.JSON(http.StatusOK, muteTimeIntervals) // TODO convert to timing interval
}

func (srv *NotificationSrv) RouteGetReceiver(c *contextmodel.ReqContext, name string) response.Response {
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

func (srv *NotificationSrv) RouteGetReceivers(c *contextmodel.ReqContext) response.Response {
	q := models.GetReceiversQuery{
		OrgID:   c.SignedInUser.OrgID,
		Names:   c.QueryStrings("names"),
		Limit:   c.QueryInt("limit"),
		Offset:  c.QueryInt("offset"),
		Decrypt: c.QueryBool("decrypt"),
	}

	receivers, err := srv.receiverService.GetReceivers(c.Req.Context(), q, c.SignedInUser)
	if err != nil {
		if errors.Is(err, notifier.ErrPermissionDenied) {
			return ErrResp(http.StatusForbidden, err, "permission denied")
		}
		return ErrResp(http.StatusInternalServerError, err, "failed to get receiver groups")
	}

	return response.JSON(http.StatusOK, receivers)
}
