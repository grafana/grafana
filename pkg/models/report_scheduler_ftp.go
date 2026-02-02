package models

type FTPConfig struct {
	Id          int64  `xorm:"id" json:"id"`
	OrgID       int64  `xorm:"org_id" json:"org_id"`
	Host        string `xorm:"ftp_host" json:"host"`
	Port        int    `xorm:"ftp_port" json:"port"`
	Username    string `xorm:"user_name" json:"username"`
	Password    string `xorm:"password" json:"password"`
	HasPassword bool   `xorm:"extends" json:"has_password"`
	IsDefault   *bool  `xorm:"default_ftp" json:"is_default"`
}

type SetFTPConfigCmd struct {
	OrgID     int64  `xorm:"org_id"`
	Host      string `xorm:"ftp_host" json:"host"`
	Port      int    `xorm:"ftp_port" json:"port"`
	Username  string `xorm:"user_name" json:"username"`
	Password  string `xorm:"password" json:"password"`
	IsDefault bool   `xorm:"default_ftp" json:"is_default"`
}

type ModifyFTPConfigCmd struct {
	Id        int64  `xorm:"id"`
	OrgID     int64  `xorm:"org_id"`
	Host      string `xorm:"ftp_host" json:"host"`
	Port      int    `xorm:"ftp_port" json:"port"`
	Username  string `xorm:"user_name" json:"username"`
	Password  string `xorm:"password" json:"password"`
	IsDefault bool   `xorm:"default_ftp" json:"is_default"`
}

type SetDefaultFTPConfigCmd struct {
	Id        int64 `xorm:"id"`
	OrgID     int64 `xorm:"org_id"`
	IsDefault bool  `xorm:"default_ftp" json:"is_default"`
}

type GetFTPConfig struct {
	OrgId  int64
	Id     int64 `xorm:"id"`
	Result *FTPConfig
}

type GetFTPConfigs struct {
	OrgId  int64
	Result []*FTPConfig
}

type GetReportByFtpConfig struct {
	FtpConfigId string `xorm:"report_ftp_config_id"`
	Result      *int64
}
type IsDefaultFTPConfig struct {
	FtpConfigId int64 `xorm:"id"`
	Result      *int64
}
type ReportModel struct {
	ID          int64  `xorm:"id"`
	Name        string `xorm:"name"`
	Description string `xorm:"description"`
	FtpConfigId string `xorm:"report_ftp_config_id"`
}
