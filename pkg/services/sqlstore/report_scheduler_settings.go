package sqlstore

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

func (ss *SQLStore) GetReportSettings(ctx context.Context, query *models.GetReportBranding) error {
	return ss.WithDbSession(ctx, func(dbSession *DBSession) error {
		result := &models.ReportBranding{}
		_, err := dbSession.Table("report_settings").
			Where("report_settings.org_id = ?", query.OrgId).
			Get(result)
		if err != nil {
			return err
		}
		query.Result = result
		return nil
	})
}
func (ss *SQLStore) SetReportSettings(ctx context.Context, query *models.SetReportBranding) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		result := &models.ReportBranding{}
		has, err := sess.Table("report_settings").
			Where("report_settings.org_id = ?", query.OrgId).
			Get(result)
		if err != nil {
			return err
		}
		if !has {
			err := insertReportSettings(sess, query)
			if err != nil {
				return err
			}
		} else {
			err := updateReportSettings(sess, query)
			if err != nil {
				return err
			}
		}
		return nil
	})
}

func (ss *SQLStore) DeleteReportSettings(ctx context.Context, query *models.DeleteReportBranding) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		q := &models.SetReportBranding{
			OrgId: query.OrgId,
			Data: models.ReportBranding{
				LogoUrl:             "",
				FooterText:          "",
				FooterTextUrl:       "",
				FooterSentBy:        false,
				InternalDomainsOnly: false,
				WhitelistedDomains:  "",
				StorageRetention:    7,
			},
		}
		return updateReportSettings(sess, q)
	})
}

func insertReportSettings(sess *DBSession, query *models.SetReportBranding) error {
	_, err := sess.Table("report_settings").
		Insert(query.Data)
	if err != nil {
		return err
	}
	return nil
}
func updateReportSettings(sess *DBSession, query *models.SetReportBranding) error {
	_, err := sess.Table("report_settings").
		Cols("company_logo_url", "footer_text",
			"footer_text_url", "footer_sent_by",
			"internal_domains_only", "whitelisted_domains", "storage_retention", "date_format").
		Where("report_settings.org_id = ?", query.OrgId).
		UseBool("footer_sent_by").
		UseBool("internal_domains_only").
		Nullable("company_logo_url", "footer_text",
			"footer_text_url", "footer_sent_by", "whitelisted_domains").
		Update(query.Data)
	if err != nil {
		return err
	}
	return nil
}
