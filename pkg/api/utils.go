package api

import (
	"context"
	"encoding/json"
	"net/mail"

	"github.com/grafana/grafana/pkg/models"
)

func jsonMap(data []byte) (map[string]string, error) {
	jsonMap := make(map[string]string)
	err := json.Unmarshal(data, &jsonMap)
	return jsonMap, err
}

func ValidateAndNormalizeEmail(email string) (string, error) {
	if email == "" {
		return "", nil
	}

	e, err := mail.ParseAddress(email)
	if err != nil {
		return "", err
	}

	return e.Address, nil
}

func (hs *HTTPServer) getDashboardUID(ctx context.Context, ID int64, orgID int64) (string, error) {
	// TODO cache
	q := &models.GetDashboardQuery{
		OrgId: orgID,
		Id:    ID,
	}
	if err := hs.DashboardService.GetDashboard(ctx, q); err != nil {
		return "", err
	}

	return q.Result.Uid, nil
}
