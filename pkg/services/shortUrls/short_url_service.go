package shortUrls

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

type ShortUrlService interface {
	GetFullUrlByUID(orgId int64, uid string) (string, error)
	CreateShortUrl(orgId int64, path string) (string, error)
}

type shortUrlServiceImpl struct {
	user *models.SignedInUser
}

var NewShortUrlService = func(orgId int64, user *models.SignedInUser) ShortUrlService {
	return &shortUrlServiceImpl{
		user: user,
	}
}

func (dr *shortUrlServiceImpl) buildCreateShortUrlCommand(orgId int64, path string) (*models.CreateShortUrlCommand, error) {
	cmd := &models.CreateShortUrlCommand{
		OrgId:     orgId,
		Uid:       util.GenerateShortUID(),
		Path:      path,
		CreatedBy: dr.user.UserId,
	}

	return cmd, nil
}

func (dr *shortUrlServiceImpl) GetFullUrlByUID(orgId int64, uid string) (string, error) {
	query := models.GetFullUrlQuery{OrgId: orgId, Uid: uid}
	if err := bus.Dispatch(&query); err != nil {
		return "", err
	}

	if err := bus.Dispatch(&models.UpdateShortUrlLastSeenAtCommand{Uid: query.Result.Uid}); err != nil {
		logger.Error("Failed to update shortUrl last_seen_at", "error", err)
	}

	return query.Result.Path, nil
}

func (dr *shortUrlServiceImpl) CreateShortUrl(orgId int64, path string) (string, error) {
	createShortUrlCmd, err := dr.buildCreateShortUrlCommand(orgId, path)
	if err != nil {
		return "", err
	}

	err = bus.Dispatch(createShortUrlCmd)
	if err != nil {
		return "", err
	}

	return createShortUrlCmd.Result.Uid, nil
}
