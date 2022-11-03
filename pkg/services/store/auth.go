package store

import (
	"context"
	"encoding/json"

	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/services/user"
)

func GetUserIDString(user *user.SignedInUser) (string, error) {
	raw, err := json.Marshal(user)
	return string(raw), err
}

func GetUserIDStringFromContext(ctx context.Context) (string, error) {
	user, err := appcontext.User(ctx)
	if err != nil {
		return "", err
	}
	return GetUserIDString(user)
}
