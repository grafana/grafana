package remote

import (
	"context"
	"sync/atomic"

	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/infra/log"
	remoteClient "github.com/grafana/grafana/pkg/services/ngalert/remote/client"
	"github.com/grafana/grafana/pkg/setting"
)

// SmtpConfigFunc returns the SMTP settings the remote Alertmanager should use to send emails.
type SmtpConfigFunc func(context.Context) remoteClient.SmtpConfig

// LiveSmtpConfig reads the SMTP settings on every call, falling back to the last ones read (initially cfg.Smtp) on error.
func LiveSmtpConfig(cfgProvider configprovider.ConfigProvider, cfg *setting.Cfg) SmtpConfigFunc {
	logger := log.New("ngalert.remote.smtp")
	var lastGood atomic.Pointer[remoteClient.SmtpConfig]
	initial := smtpConfigFromSettings(cfg.Smtp)
	lastGood.Store(&initial)

	return func(ctx context.Context) remoteClient.SmtpConfig {
		smtp, err := readSmtpSettings(ctx, cfgProvider, cfg.InstanceName)
		if err != nil {
			logger.Warn("Unable to read SMTP settings, using the last ones read", "error", err)
			return *lastGood.Load()
		}
		c := smtpConfigFromSettings(smtp)
		lastGood.Store(&c)
		return c
	}
}

func readSmtpSettings(ctx context.Context, cfgProvider configprovider.ConfigProvider, instanceName string) (setting.SmtpSettings, error) {
	iniFile, err := cfgProvider.GetSections(ctx, "smtp", "smtp.static_headers")
	if err != nil {
		return setting.SmtpSettings{}, err
	}
	return setting.ReadSmtpSettings(iniFile, instanceName)
}

func smtpConfigFromSettings(s setting.SmtpSettings) remoteClient.SmtpConfig {
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
	}
}
