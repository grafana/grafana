package channels

import (
	"strings"

	"github.com/grafana/alerting/alerting/notifier/channels"
)

var receiverFactories = map[string]func(channels.FactoryConfig) (channels.NotificationChannel, error){
	"prometheus-alertmanager": AlertmanagerFactory,
	"dingding":                DingDingFactory,
	"discord":                 DiscordFactory,
	"email":                   EmailFactory,
	"googlechat":              GoogleChatFactory,
	"kafka":                   KafkaFactory,
	"line":                    LineFactory,
	"opsgenie":                channels.OpsgenieFactory,
	"pagerduty":               channels.PagerdutyFactory,
	"pushover":                channels.PushoverFactory,
	"sensugo":                 channels.SensuGoFactory,
	"slack":                   SlackFactory,
	"teams":                   channels.TeamsFactory,
	"telegram":                channels.TelegramFactory,
	"threema":                 channels.ThreemaFactory,
	"victorops":               VictorOpsFactory,
	"webhook":                 channels.WebHookFactory,
	"wecom":                   channels.WeComFactory,
	"webex":                   channels.WebexFactory,
}

func Factory(receiverType string) (func(channels.FactoryConfig) (channels.NotificationChannel, error), bool) {
	receiverType = strings.ToLower(receiverType)
	factory, exists := receiverFactories[receiverType]
	return factory, exists
}
