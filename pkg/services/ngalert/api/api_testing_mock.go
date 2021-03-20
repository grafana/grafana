package api

import (
	"net/http"

	apimodels "github.com/grafana/alerting-api/pkg/api"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

type TestingApiMock struct {
	log log.Logger
}

func (mock TestingApiMock) RouteTestReceiverConfig(c *models.ReqContext, body apimodels.ExtendedReceiver) response.Response {
	mock.log.Info("RouteTestReceiverConfig: ", "body", body)
	return response.JSON(http.StatusOK, util.DynMap{"message": "success"})
}

func (mock TestingApiMock) RouteTestRuleConfig(c *models.ReqContext, body apimodels.TestRulePayload) response.Response {
	mock.log.Info("RouteTestRuleConfig: ", "body", body)
	result := apimodels.TestRuleResponse{
		GrafanaAlertInstances: apimodels.AlertInstancesResponse{
			Instances: [][]byte{
				[]byte("QVJST1cxAAD/////+AAAABAAAAAAAAoADgAMAAsABAAKAAAAFAAAAAAAAAEDAAoADAAAAAgABAAKAAAACAAAAFAAAAACAAAAKAAAAAQAAACE////CAAAAAwAAAAAAAAAAAAAAAUAAAByZWZJZAAAAKT///8IAAAADAAAAAAAAAAAAAAABAAAAG5hbWUAAAAAAQAAABgAAAAAABIAGAAUAAAAEwAMAAAACAAEABIAAAAUAAAAQAAAAEQAAAAAAAAGQAAAAAEAAAAMAAAACAAMAAgABAAIAAAACAAAAAwAAAAAAAAAAAAAAAQAAABuYW1lAAAAAAAAAAAEAAQABAAAAAAAAAAAAAAA/////4gAAAAUAAAAAAAAAAwAFgAUABMADAAEAAwAAAAIAAAAAAAAABQAAAAAAAADAwAKABgADAAIAAQACgAAABQAAAA4AAAAAQAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAEAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAQAAAADAAUABIADAAIAAQADAAAABAAAAAsAAAAPAAAAAAAAwABAAAACAEAAAAAAACQAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAKAAwAAAAIAAQACgAAAAgAAABQAAAAAgAAACgAAAAEAAAAhP///wgAAAAMAAAAAAAAAAAAAAAFAAAAcmVmSWQAAACk////CAAAAAwAAAAAAAAAAAAAAAQAAABuYW1lAAAAAAEAAAAYAAAAAAASABgAFAAAABMADAAAAAgABAASAAAAFAAAAEAAAABEAAAAAAAABkAAAAABAAAADAAAAAgADAAIAAQACAAAAAgAAAAMAAAAAAAAAAAAAAAEAAAAbmFtZQAAAAAAAAAABAAEAAQAAAAAAAAAAAAAACgBAABBUlJPVzE="),
			},
		},
	}
	return response.JSON(http.StatusOK, result)
}
