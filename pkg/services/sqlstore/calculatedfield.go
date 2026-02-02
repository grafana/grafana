/*
 * Copyright (C) 2021-2025 BMC Helix Inc
 * Added by abhasin at 03/08/2021
 */

package sqlstore

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

func (ss *SQLStore) GetCalculatedField(ctx context.Context, query *models.GetCalculatedField) error {
	return ss.WithDbSession(ctx, func(dbSession *DBSession) error {
		results := make([]*models.CalculatedField, 0)

		sess := dbSession.Table("calculatedfield").
			Where("calculatedfield.org_id in (1, ?)", query.OrgId)

		if err := sess.
			Find(&results); err != nil {
			return err
		}

		query.Result = results
		return nil
	})
}
