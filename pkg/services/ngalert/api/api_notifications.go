package api

import (
	"context"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	. "github.com/grafana/grafana/pkg/services/ngalert/api/compat"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type NotificationSrv struct {
	logger            log.Logger
	receiverService   ReceiverService
	muteTimingService MuteTimingService // defined in api_provisioning.go
}

type ReceiverService interface {
	GetReceiver(ctx context.Context, q models.GetReceiverQuery, u identity.Requester) (*models.Receiver, error)
	ListReceivers(ctx context.Context, q models.ListReceiversQuery, user identity.Requester) ([]*models.Receiver, error)
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
		return response.ErrOrFallback(http.StatusInternalServerError, "failed to get receiver", err)
	}

	gettable, err := GettableApiReceiverFromReceiver(receiver)
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "failed to convert receiver", err)
	}

	return response.JSON(http.StatusOK, gettable)
}

func (srv *NotificationSrv) RouteGetReceivers(c *contextmodel.ReqContext) response.Response {
	q := models.ListReceiversQuery{
		OrgID:  c.SignedInUser.OrgID,
		Names:  c.QueryStrings("names"),
		Limit:  c.QueryInt("limit"),
		Offset: c.QueryInt("offset"),
	}

	receivers, err := srv.receiverService.ListReceivers(c.Req.Context(), q, c.SignedInUser)
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "failed to get receiver groups", err)
	}

	gettables, err := GettableApiReceiversFromReceivers(receivers)
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "failed to convert receivers", err)
	}

	return response.JSON(http.StatusOK, gettables)
}
