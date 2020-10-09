package shorturls

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

type ShortURLService struct {
	user *models.SignedInUser
}

var NewShortURLService = func(user *models.SignedInUser) ShortURLService {
	return ShortURLService{
		user: user,
	}
}

func (dr ShortURLService) GetFullURLByUID(uid string) (string, error) {
	query := models.GetShortURLByUIDQuery{OrgID: dr.user.OrgId, UID: uid}
	if err := bus.Dispatch(&query); err != nil {
		return "", err
	}

	if err := bus.Dispatch(&models.UpdateShortURLLastSeenAtCommand{UID: query.Result.Uid}); err != nil {
		logger.Error("Failed to update shortURL last_seen_at", "error", err)
	}

	return query.Result.Path, nil
}

func (dr ShortURLService) CreateShortURL(path string) (string, error) {
	cmd := models.CreateShortURLCommand{
		OrgID:     dr.user.OrgId,
		UID:       util.GenerateShortUID(),
		Path:      path,
		CreatedBy: dr.user.UserId,
	}

	if err := bus.Dispatch(&cmd); err != nil {
		return "", err
	}

	return cmd.Result.Uid, nil
}
