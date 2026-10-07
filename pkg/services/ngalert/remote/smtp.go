package remote

import (
	"context"

	"github.com/grafana/grafana/pkg/configprovider"
	remoteClient "github.com/grafana/grafana/pkg/services/ngalert/remote/client"
	"github.com/grafana/grafana/pkg/setting"
)

// SmtpConfigFunc returns the SMTP settings the remote Alertmanager should use to send emails.
type SmtpConfigFunc func(context.Context) (remoteClient.SmtpConfig, error)

// LiveSmtpConfig reads the SMTP settings on every call, so remote changes apply without a restart.
func LiveSmtpConfig(cfgProvider configprovider.ConfigProvider, cfg *setting.Cfg) SmtpConfigFunc {
	return func(ctx context.Context) (remoteClient.SmtpConfig, error) {
		iniFile, err := cfgProvider.GetSections(ctx, "smtp", "smtp.static_headers")
		if err != nil {
			return remoteClient.SmtpConfig{}, err
		}
		s, err := setting.ReadSmtpSettings(iniFile, cfg.InstanceName)
		if err != nil {
			return remoteClient.SmtpConfig{}, err
		}
		return remoteClient.SmtpConfig{
			FromAddress:    s.FromAddress,
			FromName:       s.FromName,
			Host:           s.Host,
			User:           s.User,
			Password:       s.Password,
			EhloIdentity:   s.EhloIdentity,
			StartTLSPolicy: s.StartTLSPolicy,
			SkipVerify:     s.SkipVerify,
			StaticHeaders:  s.StaticHeaders,
		}, nil
	}
}
