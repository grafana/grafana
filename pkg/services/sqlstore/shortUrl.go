package sqlstore

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", GetFullURLByUid)
	bus.AddHandler("sql", UpdateShortURLLastSeenAt)
	bus.AddHandler("sql", CreateShortURL)
}

func GetFullURLByUid(query *models.GetShortURLByUIDQuery) error {
	var shortURL models.ShortUrl
	exists, err := x.Where("org_id=? AND uid=?", query.OrgId, query.Uid).Get(&shortURL)
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
		OrgId:      cmd.OrgId,
		Uid:        cmd.Uid,
		LastSeenAt: now,
	}

	_, err := x.Where("org_id=? AND uid=?", shortURL.OrgId, shortURL.Uid).Update(&shortURL)
	return err
}

func CreateShortURL(command *models.CreateShortURLCommand) error {
	now := getTime().Unix()
	shortURL := models.ShortUrl{
		OrgId:     command.OrgId,
		Uid:       command.Uid,
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
