package shorturls

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

type ShortURLService interface {
	GetFullURLByUID(uid string) (string, error)
	CreateShortURL(path string) (string, error)
}

type shortURLServiceImpl struct {
	user *models.SignedInUser
}

var NewShortURLService = func(user *models.SignedInUser) ShortURLService {
	return &shortURLServiceImpl{
		user: user,
	}
}

func (dr *shortURLServiceImpl) buildCreateShortURLCommand(path string) (*models.CreateShortURLCommand, error) {
	cmd := &models.CreateShortURLCommand{
		OrgID:     dr.user.OrgId,
		UID:       util.GenerateShortUID(),
		Path:      path,
		CreatedBy: dr.user.UserId,
	}

	return cmd, nil
}

func (dr *shortURLServiceImpl) GetFullURLByUID(uid string) (string, error) {
	query := models.GetShortURLByUIDQuery{OrgID: dr.user.OrgId, UID: uid}
	if err := bus.Dispatch(&query); err != nil {
		return "", err
	}

	if err := bus.Dispatch(&models.UpdateShortURLLastSeenAtCommand{UID: query.Result.Uid}); err != nil {
		logger.Error("Failed to update shortURL last_seen_at", "error", err)
	}

	return query.Result.Path, nil
}

func (dr *shortURLServiceImpl) CreateShortURL(path string) (string, error) {
	createShortURLCmd, err := dr.buildCreateShortURLCommand(path)
	if err != nil {
		return "", err
	}

	err = bus.Dispatch(createShortURLCmd)
	if err != nil {
		return "", err
	}

	return createShortURLCmd.Result.Uid, nil
}
