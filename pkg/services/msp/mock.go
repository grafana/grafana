package msp

import (
	"os"
	"strings"

	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/util"
)

func MockMspCtx(ctx *contextmodel.ReqContext) {
	mspMock := os.Getenv("EXTERNAL_ORGS")

	mspListMock := util.SplitString(mspMock)
	if len(mspListMock) == 0 {
		ctx.HasExternalOrg = false
		ctx.IsUnrestrictedUser = false
		ctx.MspOrgs = []string{}
		printMockCtxMspLog(ctx)
		return
	}

	ctx.MspOrgs = append(ctx.MspOrgs, mspListMock...)
	ctx.IsUnrestrictedUser = util.Contains(mspListMock, "0")
	ctx.HasExternalOrg = true

	printMockCtxMspLog(ctx)
}

func printMockCtxMspLog(ctx *contextmodel.ReqContext) {
	if len(ctx.MspOrgs) == 0 {
		ctx.Logger.Info("User is not associated with any external organizations", "TenantID", ctx.OrgID, "UserID", ctx.UserID)
		return
	}

	if len(ctx.MspOrgs) == 1 && util.Contains(ctx.MspOrgs, "0") {
		ctx.Logger.Info("User is associated only with organization zero",
			"TenantID", ctx.OrgID, "UserID", ctx.UserID, "HasExternalOrg", ctx.HasExternalOrg,
			"IsUnrestricatedUser", ctx.IsUnrestrictedUser, "Orgs", strings.Join(ctx.MspOrgs, ","),
		)
		return
	}

	ctx.Logger.Info("User is associated with external organizations",
		"TenantID", ctx.OrgID, "UserID", ctx.UserID, "HasExternalOrg", ctx.HasExternalOrg,
		"IsUnrestricatedUser", ctx.IsUnrestrictedUser, "Orgs", strings.Join(ctx.MspOrgs, ","),
	)
}
