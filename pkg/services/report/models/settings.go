package models

import (
	"github.com/grafana/grafana/pkg/infra/filestorage"
)

type Settings struct {
	ID                      int64  `xorm:"'id' autoincr pk"`
	UserID                  int64  `xorm:"user_id"`
	OrgID                   int64  `xorm:"org_id"`
	BrandingReportLogoURL   string `xorm:"branding_report_logo_url"`
	BrandingEmailLogoURL    string `xorm:"branding_email_logo_url"`
	BrandingEmailFooterMode string
	BrandingEmailFooterText string
	BrandingEmailFooterLink string

	UploadedReportLogo *filestorage.File `xorm:"-"`
	UploadedEmailLogo  *filestorage.File `xorm:"-"`
}

func (Settings) TableName() string {
	return "report_settings"
}
