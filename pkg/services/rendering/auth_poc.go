package rendering

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type perUserRenderKeyProvider struct {
	sqlStore  *sqlstore.SQLStore
	log       log.Logger
	keyMaxAge time.Duration
}

func (r *perUserRenderKeyProvider) get(ctx context.Context, opts AuthOpts) (string, error) {
	renderUser := models.RenderUser{
		OrgID:   opts.OrgID,
		UserID:  opts.UserID,
		OrgRole: string(opts.OrgRole),
	}
	findAndRefreshCommand := &models.FindAndRefreshRenderKeyCommand{
		RenderUser: renderUser,
		MaxAge:     r.keyMaxAge,
	}
	err := r.sqlStore.FindAndRefreshRenderKey(ctx, findAndRefreshCommand)
	if err != nil {
		r.log.Error("Failed to find and refresh render key", "error", err)
		return "", nil
	}

	existingKey := *findAndRefreshCommand.Result
	if existingKey != "" {
		r.log.Info("Found an existing render key", "userId", opts.UserID, "orgId", opts.OrgID, "orgRole", opts.OrgRole)
		return existingKey, nil
	}

	newKey, err := generateRenderKey()
	if err != nil {
		r.log.Error("Failed to generate a new render key", "error", err)
		return "", nil
	}

	saveCommand := &models.SaveRenderKeyCommand{
		RenderUser: renderUser,
		RenderKey:  newKey,
	}
	err = r.sqlStore.SaveRenderKey(ctx, saveCommand)

	if err != nil {
		r.log.Error("Failed to save a new render key", "error", err)
		return "", nil
	}

	r.log.Info("Generated a new render key", "userId", opts.UserID, "orgId", opts.OrgID, "orgRole", opts.OrgRole)
	return newKey, nil
}

func (r *perUserRenderKeyProvider) afterRequest(ctx context.Context, opts AuthOpts, renderKey string) {
}

func (rs *RenderingService) getRenderUserPOC(ctx context.Context, key string) (*models.RenderUser, bool) {
	findRenderUserQuery := &models.FindRenderUserQuery{
		RenderKey: key,
		MaxAge:    rs.perUserRenderKeyProviderKeyMaxAge,
	}
	err := rs.sqlStore.FindRenderUser(ctx, findRenderUserQuery)

	if err != nil {
		rs.log.Error("Failed to retrieve render key from the database", "error", err)
		return nil, false
	}

	if findRenderUserQuery.Result != nil {
		return findRenderUserQuery.Result, true
	}

	rs.log.Error("Failed to find render user", "renderKey", key)
	return nil, false
}
