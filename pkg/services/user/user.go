package user

import (
	"github.com/jinzhu/gorm"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/database"
	"github.com/grafana/grafana/pkg/services/userauth"
)

type User struct {
	Database *database.Database `inject:""`
	Auth     *userauth.UserAuth `inject:""`
}

func init() {
	registry.RegisterService(&User{})
}

// Init initiates the user struct
func (user *User) Init() error {
	return nil
}

// Upsert the user
// func (user *User) Update(params *models.ExternalUserInfo) error {
// 	var data models.User

// 	auth, err := user.Auth.First(params)
// 	if err != nil {
// 		return err
// 	}

// 	if auth != nil {
// 		data, err = user.First(auth.UserId)
// 		if err != nil {
// 			return err
// 		}
// 	} else {
// 		data, err = user.Find(params)
// 		if err != nil {
// 			return err
// 		}
// 	}

// 	// 	type ExternalUserInfo struct {
// 	// 	OAuthToken     *oauth2.Token
// 	// 	AuthModule     string
// 	// 	AuthId         string
// 	// 	UserId         int64
// 	// 	Email          string
// 	// 	Login          string
// 	// 	Name           string
// 	// 	Groups         []string
// 	// 	OrgRoles       map[int64]RoleType
// 	// 	IsGrafanaAdmin *bool // This is a pointer to know if we should sync this or not (nil = ignore sync)
// 	// 	IsDisabled     bool
// 	// }

// 	// 	type User struct {
// 	// 	Id            int64
// 	// 	Version       int
// 	// 	Email         string
// 	// 	Name          string
// 	// 	Login         string
// 	// 	Password      string
// 	// 	Salt          string
// 	// 	Rands         string
// 	// 	Company       string
// 	// 	EmailVerified bool
// 	// 	Theme         string
// 	// 	HelpFlags1    HelpFlags1
// 	// 	IsDisabled    bool

// 	// 	IsAdmin bool
// 	// 	OrgId   int64

// 	// 	Created    time.Time
// 	// 	Updated    time.Time
// 	// 	LastSeenAt time.Time
// 	// }

// 	// user.Database.Where(data).Assign(
// 	// 	{Age: 20}
// 	// ).FirstOrCreate(&user)

// 	return nil
// }

// First finds user by ID
// func (user *User) First(id int64) (
// 	*models.User, error,
// ) {
// 	var data models.User

// 	err := user.Database.First(&data, id).Error
// 	if gorm.IsRecordNotFoundError(err) {
// 		return nil, nil
// 	}

// 	if err != nil {
// 		return nil, err
// 	}

// 	return data, nil
// }

// Find searches for the user by email or login
func (user *User) Find(params *models.ExternalUserInfo) (
	*models.User, error,
) {
	var data models.User

	err := user.Database.ORM.Where(
		"email = ?", params.Email,
	).Or(
		"login = ?", params.Login,
	).First(&data).Error

	if gorm.IsRecordNotFoundError(err) {
		return nil, nil
	}

	if err != nil {
		return nil, err
	}

	return &data, nil
}
