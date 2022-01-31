package services

import (
	"errors"
	"fmt"
	"net/url"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/channels"
)

func validateContactPoint(e *EmbeddedContactPoint) (bool, error) {
	if e.Type == "" {
		return false, ErrContactPointNoTypeSet
	}
	if e.Settings == nil {
		return false, ErrContactPointNoSettingsSet
	}
	return validateSettings(e.Type, e.Settings)
}

func validateSettings(channelType string, settings *simplejson.Json) (bool, error) {
	switch strings.ToLower(channelType) {
	case "alertmanager":
		urlStr := settings.Get("url").MustString()
		if urlStr == "" {
			return false, errors.New("could not find url property in settings")
		}

		for _, uS := range strings.Split(urlStr, ",") {
			uS = strings.TrimSpace(uS)
			if uS == "" {
				continue
			}

			uS = strings.TrimSuffix(uS, "/") + "/api/v1/alerts"
			_, err := url.Parse(uS)
			if err != nil {
				return false, errors.New("invalid url property in settings")
			}
		}
		return true, nil
	case "dingding":
		url := settings.Get("url").MustString()
		if url == "" {
			return false, errors.New("could not find url property in settings")
		}
		return true, nil
	case "discord":
		discordURL := settings.Get("url").MustString()
		if discordURL == "" {
			return false, errors.New("could not find webhook url property in settings")
		}
		return true, nil
	case "email":
		addressesString := settings.Get("addresses").MustString()
		if addressesString == "" {
			return false, errors.New("could not find addresses in settings")
		}
		return true, nil
	case "googlechat":
		url := settings.Get("url").MustString()
		if url == "" {
			return false, errors.New("could not find url property in settings")
		}
		return true, nil
	case "kafka":
		endpoint := settings.Get("kafkaRestProxy").MustString()
		if endpoint == "" {
			return false, errors.New("could not find kafka rest proxy endpoint property in settings")
		}
		topic := settings.Get("kafkaTopic").MustString()
		if topic == "" {
			return false, errors.New("could not find kafka topic property in settings")
		}
		return true, nil
	case "line":
		token := settings.Get("token").MustString()
		if token == "" {
			return false, errors.New("could not find token in settings")
		}
		return true, nil
	case "opsgenie":
		apiKey := settings.Get("apiKey").MustString()
		if apiKey == "" {
			return false, errors.New("could not find api key property in settings")
		}
		sendTagsAs := settings.Get("sendTagsAs").MustString(channels.OpsgenieSendTags)
		if sendTagsAs != channels.OpsgenieSendTags &&
			sendTagsAs != channels.OpsgenieSendDetails &&
			sendTagsAs != channels.OpsgenieSendBoth {
			return false, fmt.Errorf("invalid value for sendTagsAs: %q", sendTagsAs)
		}
		return true, nil
	case "pagerduty":
		key := settings.Get("integrationKey").MustString()
		if key == "" {
			return false, errors.New("could not find integration key property in settings")
		}
		return true, nil
	case "pushover":
		userKey := settings.Get("userKey").MustString()
		if userKey == "" {
			return false, errors.New("user key not found")
		}
		APIToken := settings.Get("apiToken").MustString()
		if APIToken == "" {
			return false, errors.New("API token not found")
		}
		_, err := strconv.Atoi(settings.Get("priority").MustString("0")) // default Normal
		if err != nil {
			return false, fmt.Errorf("failed to convert alerting priority to integer: %w", err)
		}
		_, err = strconv.Atoi(settings.Get("okPriority").MustString("0")) // default Normal
		if err != nil {
			return false, fmt.Errorf("failed to convert OK priority to integer: %w", err)
		}
		return true, nil
	case "sensugo":
		url := settings.Get("url").MustString()
		if url == "" {
			return false, errors.New("could not find URL property in settings")
		}

		apikey := settings.Get("apikey").MustString()
		if apikey == "" {
			return false, errors.New("could not find the API key property in settings")
		}
		return true, nil
	case "slack":
		slackURL := settings.Get("url").MustString()
		if slackURL == "" {
			slackURL = channels.SlackAPIEndpoint
		}
		apiURL, err := url.Parse(slackURL)
		if err != nil {
			return false, fmt.Errorf("invalid URL %q", slackURL)
		}
		recipient := strings.TrimSpace(settings.Get("recipient").MustString())
		if recipient == "" && apiURL.String() == channels.SlackAPIEndpoint {
			return false, errors.New("recipient must be specified when using the Slack chat API")
		}

		mentionChannel := settings.Get("mentionChannel").MustString()
		if mentionChannel != "" && mentionChannel != "here" && mentionChannel != "channel" {
			return false, fmt.Errorf("invalid value for mentionChannel: %q", mentionChannel)
		}

		token := settings.Get("token").MustString()
		if token == "" && apiURL.String() == channels.SlackAPIEndpoint {
			return false, errors.New("token must be specified when using the Slack chat API")
		}
		return true, nil
	case "teams":
		u := settings.Get("url").MustString()
		if u == "" {
			return false, errors.New("could not find url property in settings")
		}
		return true, nil
	case "telegram":
		botToken := settings.Get("bottoken").MustString()
		if botToken == "" {
			return false, errors.New("could not find Bot Token in settings")
		}
		chatID := settings.Get("chatid").MustString()
		if chatID == "" {
			return false, errors.New("could not find Chat Id in settings")
		}
	case "threema":
		gatewayID := settings.Get("gateway_id").MustString()
		if gatewayID == "" {
			return false, errors.New("could not find Threema Gateway ID in settings")
		}
		if !strings.HasPrefix(gatewayID, "*") {
			return false, errors.New("invalid Threema Gateway ID: Must start with a *")
		}
		if len(gatewayID) != 8 {
			return false, errors.New("invalid Threema Gateway ID: Must be 8 characters long")
		}
		recipientID := settings.Get("recipient_id").MustString()
		if recipientID == "" {
			return false, errors.New("could not find Threema Recipient ID in settings")
		}
		if len(recipientID) != 8 {
			return false, errors.New("invalid Threema Recipient ID: Must be 8 characters long")
		}
		apiSecret := settings.Get("api_secret").MustString()
		if apiSecret == "" {
			return false, errors.New("could not find Threema API secret in settings")
		}
	case "victorops":
		url := settings.Get("url").MustString()
		if url == "" {
			return false, errors.New("could not find victorops url property in settings")
		}
		return true, nil
	case "webhook":
		url := settings.Get("url").MustString()
		if url == "" {
			return false, errors.New("could not find url property in settings")
		}
	case "wecom":
		url := settings.Get("url").MustString()
		if url == "" {
			return false, errors.New("could not find webhook URL in settings")
		}
	}
	return false, fmt.Errorf("contact point has an unknown type '%s'", channelType)
}
