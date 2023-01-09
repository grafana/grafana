package models

type Password string

func (p Password) IsWeak() bool {
	return len(p) <= 4
}

type UserIdDTO struct {
	Id      int64  `json:"id"`
	Message string `json:"message"`
}

// implement Conversion interface to define custom field mapping (xorm feature)
type AuthModuleConversion []string

func (auth *AuthModuleConversion) FromDB(data []byte) error {
	auth_module := string(data)
	*auth = []string{auth_module}
	return nil
}

// Just a stub, we don't want to write to database
func (auth *AuthModuleConversion) ToDB() ([]byte, error) {
	return []byte{}, nil
}
