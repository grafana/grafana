package users

type usersAsConfig struct {
	Users []*userFromConfig
}

type userFromConfig struct {
	Name     string
	Login    string
	Email    string
	Password string
	OrgID    int64
}

func (cfg *usersAsConfig) mapToUserFromConfig(cr *configReader) *usersAsConfig {
	r := &usersAsConfig{}
	if cfg == nil {
		return r
	}

	for _, user := range cfg.Users {

		r.Users = append(r.Users, &userFromConfig{
			Name:     user.Name,
			Login:    user.Login,
			Email:    user.Email,
			Password: user.Password,
			OrgID:    user.OrgID,
		})
	}

	return r
}
