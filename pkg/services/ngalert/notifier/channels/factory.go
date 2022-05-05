package channels

import (
	"errors"
	"strings"

	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/prometheus/alertmanager/template"
)

type FactoryConfig struct {
	Config              *NotificationChannelConfig
	NotificationService notifications.Service
	DecryptFunc         GetDecryptedValueFn
	Template            *template.Template
}

func NewFactoryConfig(config *NotificationChannelConfig, notificationService notifications.Service,
	decryptFunc GetDecryptedValueFn, template *template.Template) (FactoryConfig, error) {
	if config.Settings == nil {
		return FactoryConfig{}, errors.New("no settings supplied")
	}
	// not all receivers do need secure settings, we still might interact with
	// them, so we make sure they are never nil
	if config.SecureSettings == nil {
		config.SecureSettings = map[string][]byte{}
	}
	return FactoryConfig{
		Config:              config,
		NotificationService: notificationService,
		DecryptFunc:         decryptFunc,
		Template:            template,
	}, nil
}

var receiverFactories = map[string]func(FactoryConfig) (NotificationChannel, error){
	"prometheus-alertmanager": AlertmanagerFactory,
	"dingding":                DingDingFactory,
	"discord":                 DiscordFactory,
	"email":                   EmailFactory,
	"googlechat":              GoogleChatFactory,
	"kafka":                   KafkaFactory,
	"line":                    LineFactory,
	"opsgenie":                OpsgenieFactory,
	"pagerduty":               PagerdutyFactory,
	"pushover":                PushoverFactory,
	"sensugo":                 SensuGoFactory,
	"slack":                   SlackFactory,
	"teams":                   TeamsFactory,
	"telegram":                TelegramFactory,
	"threema":                 ThreemaFactory,
	"victorops":               VictorOpsFactory,
	"webhook":                 WebHookFactory,
	"wecom":                   WeComFactory,
}

func Factory(receiverType string) (func(FactoryConfig) (NotificationChannel, error), bool) {
	receiverType = strings.ToLower(receiverType)
	factory, exists := receiverFactories[receiverType]
	return factory, exists
}
