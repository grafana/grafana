package shortUrls

import (
	"log"
	"time"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

// ShortUrlService service for operating on shortUrls
type ShortUrlService interface {
	GetFullUrlByUID(uid string) (string, error)
	CreateShortUrl(cmd *dtos.CreateShortUrlForm) (string, error)
}

type shortUrlServiceImpl struct {
	user *models.SignedInUser
	log  log.Logger
}

// NewShortUrlService factory for creating a new shortUrl service
var NewShortUrlService = func(orgId int64, user *models.SignedInUser) ShortUrlService {
	return &shortUrlServiceImpl{
		user: user,
	}
}

func (dr *shortUrlServiceImpl) buildCreateShortUrlCommand(path string) (*models.CreateShortUrlCommand, error) {
	cmd := &models.CreateShortUrlCommand{
		Uid:       util.GenerateShortUID(),
		Path:      path,
		CreatedBy: dr.user.UserId,
		CreatedAt: time.Now(),
	}

	return cmd, nil
}

func (dr *shortUrlServiceImpl) GetFullUrlByUID(uid string) (string, error) {
	query := models.GetFullUrlQuery{Uid: uid}
	fullUrl, err := getFullUrl(query)

	if err != nil {
		return "", err
	}

	return fullUrl, nil
}

func (dr *shortUrlServiceImpl) CreateShortUrl(cmd *dtos.CreateShortUrlForm) (string, error) {
	createShortUrlCmd, err := dr.buildCreateShortUrlCommand(cmd.Path)
	if err != nil {
		return "", err
	}

	err = bus.Dispatch(createShortUrlCmd)
	if err != nil {
		return "", err
	}

	return createShortUrlCmd.Result.Uid, nil
}

func getFullUrl(query models.GetFullUrlQuery) (string, error) {
	if err := bus.Dispatch(&query); err != nil {
		return "", err
	}

	if query.Result.Path == "" {
		return "", models.ErrShortUrlNotFound
	}

	return query.Result.Path, nil
}
