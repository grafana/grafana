package msp

import (
	"strconv"

	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"

	logger "github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/setting"
)

var log = logger.New("msp")

type Service struct {
	store         *sqlstore.SQLStore
	teamService   team.Service
	Cfg           setting.Cfg
	AccessControl accesscontrol.AccessControl
}

func NewService(store *sqlstore.SQLStore, teamService team.Service, Cfg setting.Cfg, AccessControl accesscontrol.AccessControl) *Service {
	return &Service{store: store, teamService: teamService, Cfg: Cfg, AccessControl: AccessControl}
}

func CreateTeamIDWithOrgString(tenantID int64, mspOrgID string) int64 {
	mspID, _ := strconv.Atoi(mspOrgID)
	var num int64
	var concatenated string
	if mspID == 0 {
		if mspOrgID == "00" {
			concatenated = "990" + "00" + strconv.FormatInt(tenantID, 10)
		} else {
			concatenated = "90000" + strconv.FormatInt(int64(mspID), 10) + strconv.FormatInt(tenantID, 10)
		}
	} else {
		num = 90000 + int64(mspID)
		concatenated = strconv.FormatInt(num, 10) + strconv.FormatInt(tenantID, 10)
	}

	mspTeamID, _ := strconv.Atoi(concatenated)
	return int64(mspTeamID)
}

func GetMspOrgIdsFromCtx(ctx *contextmodel.ReqContext) []int64 {
	mspTeamIDs := make([]int64, 0)
	for _, mspOrgId := range ctx.SignedInUser.MspOrgs {
		mspTeamID := CreateTeamIDWithOrgString(ctx.OrgID, mspOrgId)
		mspTeamIDs = append(mspTeamIDs, mspTeamID)
	}
	if ctx.SignedInUser.IsUnrestrictedUser {
		mspTeamID := CreateTeamIDWithOrgString(ctx.OrgID, "00")
		mspTeamIDs = append(mspTeamIDs, mspTeamID)
	}
	return mspTeamIDs
}
