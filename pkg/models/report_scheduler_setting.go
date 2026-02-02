package models

type ReportBranding struct {
	LogoUrl             string `xorm:"company_logo_url"`
	FooterText          string `xorm:"footer_text"`
	FooterTextUrl       string `xorm:"footer_text_url"`
	FooterSentBy        bool   `xorm:"footer_sent_by"`
	InternalDomainsOnly bool   `xorm:"internal_domains_only"`
	WhitelistedDomains  string `xorm:"whitelisted_domains"`
	DateFormat          string `xorm:"date_format"`
	StorageRetention    int    `xorm:"storage_retention"`
	OrgID               int64  `xorm:"org_id"`
}

type GetReportBranding struct {
	OrgId  int64
	Result *ReportBranding
}

type SetReportBranding struct {
	OrgId int64
	Data  ReportBranding `xorm:"extends"`
}

type DeleteReportBranding struct {
	OrgId int64
}
