package userauth

import (
	"github.com/jinzhu/gorm"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/database"
)

type UserAuth struct {
	Database *database.Database `inject:""`
}

func init() {
	registry.RegisterService(&UserAuth{})
}

// Init initiates the user struct
func (auth *UserAuth) Init() error {
	return nil
}

// First is looking for the user auth data
func (auth *UserAuth) First(params *models.ExternalUserInfo) (
	*models.UserAuth, error,
) {
	var userAuth models.UserAuth

	err := auth.Database.ORM.Where(
		&models.UserAuth{
			UserId:     params.UserId,
			AuthModule: params.AuthModule,
			AuthId:     params.AuthId,
		},
	).First(&userAuth).Error

	if gorm.IsRecordNotFoundError(err) {
		return nil, nil
	}

	if err != nil {
		return nil, err
	}

	return &userAuth, nil
}
