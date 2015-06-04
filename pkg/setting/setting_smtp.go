package setting

type SmtpSettings struct {
	Host        string
	User        string
	Password    string
	CertFile    string
	KeyFile     string
	FromAddress string
	SkipVerify  bool
}
