package sqlstore

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", GetFullURLByUID)
	bus.AddHandler("sql", UpdateShortURLLastSeenAt)
	bus.AddHandler("sql", CreateShortURL)
}

func GetFullURLByUID(query *models.GetShortURLByUIDQuery) error {
	var shortURL models.ShortUrl
	exists, err := x.Where("org_id=? AND uid=?", query.OrgID, query.UID).Get(&shortURL)
	if err != nil {
		return err
	}

	if !exists {
		return models.ErrShortURLNotFound
	}

	query.Result = &shortURL
	return nil
}

func UpdateShortURLLastSeenAt(cmd *models.UpdateShortURLLastSeenAtCommand) error {
	now := getTime().Unix()
	var shortURL = models.ShortUrl{
		OrgId:      cmd.OrgID,
		Uid:        cmd.UID,
		LastSeenAt: now,
	}

	_, err := x.Where("org_id=? AND uid=?", shortURL.OrgId, shortURL.Uid).Update(&shortURL)
	return err
}

func CreateShortURL(command *models.CreateShortURLCommand) error {
	now := getTime().Unix()
	shortURL := models.ShortUrl{
		OrgId:     command.OrgID,
		Uid:       command.UID,
		Path:      command.Path,
		CreatedBy: command.CreatedBy,
		CreatedAt: now,
	}

	_, err := x.Insert(&shortURL)
	if err != nil {
		return err
	}

	command.Result = &shortURL
	return err
}
