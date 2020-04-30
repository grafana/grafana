package users

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
)

func Provision(configDirectory string) error {
	dc := newUsersProvisioner(log.New("provisioning.users"))
	return dc.applyChanges(configDirectory)
}

type UsersProvisioner struct {
	log         log.Logger
	cfgProvider *configReader
}

func newUsersProvisioner(log log.Logger) UsersProvisioner {
	return UsersProvisioner{
		log:         log,
		cfgProvider: &configReader{log: log},
	}
}

// For each of the users in the config, create them if they do not already
// exist. If they do exist, update their email, login, and password fields.
func (dc *UsersProvisioner) apply(cfg *usersAsConfig) error {
	for _, user := range cfg.Users {
		// First check if the user already exists
		// TODO: Is user.Email the right thing to check here?
		query := models.GetUserByLoginQuery{LoginOrEmail: user.Email}
		if err := bus.Dispatch(&query); err != nil {
			if err == models.ErrUserNotFound {
				// The user doesn't exist, so create it
				cmd := models.CreateUserCommand{
					Login:    user.Login,
					Email:    user.Email,
					Password: user.Password,
					Name:     user.Name,
					OrgId:    user.OrgID,
				}
				if err := bus.Dispatch(&cmd); err != nil {
					return err
				}
			} else {
				return err
			}
		} else {
			// The user already exists, update it from the config
			cmd := models.UpdateUserCommand{
				Login: user.Login,
				Email: user.Email,
				Name:  user.Name,
			}
			if err := bus.Dispatch(&cmd); err != nil {
				return err
			}
		}
	}

	return nil
}

// Find and read all the configs in the config path, then for each config
// create/update the users as necessary.
func (dc *UsersProvisioner) applyChanges(configPath string) error {
	configs, err := dc.cfgProvider.readConfig(configPath)
	if err != nil {
		return err
	}

	for _, cfg := range configs {
		if err := dc.apply(cfg); err != nil {
			return err
		}
	}

	return nil
}
