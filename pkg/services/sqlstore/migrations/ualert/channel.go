package ualert

import (
	"fmt"

	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/pkg/labels"

	"github.com/grafana/grafana/pkg/components/securejsondata"
	"github.com/grafana/grafana/pkg/components/simplejson"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

type notificationChannel struct {
	Uid                   string                        `xorm:"uid"`
	OrgId                 int64                         `xorm:"org_id"`
	Name                  string                        `xorm:"name"`
	Type                  string                        `xorm:"type"`
	DisableResolveMessage bool                          `xorm:"disable_resolve_message"`
	IsDefault             bool                          `xorm:"is_default"`
	Settings              *simplejson.Json              `xorm:"settings"`
	SecureSettings        securejsondata.SecureJsonData `xorm:"secure_settings"`
}

func (m *migration) getNotificationChannelMap() (map[string]*notificationChannel, *notificationChannel, error) {
	q := `
	SELECT uid,
		org_id,
		name,
		type,
		disable_resolve_message,
		is_default,
		settings,
		secure_settings
	FROM
		dashboard
	`
	allChannels := []notificationChannel{}
	err := m.sess.SQL(q).Find(&allChannels)
	if err != nil {
		return nil, nil, err
	}

	if len(allChannels) == 0 {
		return nil, nil, nil
	}

	allChannelsMap := make(map[string]*notificationChannel)
	var defaultChannel *notificationChannel
	for _, c := range allChannels {
		allChannelsMap[c.Uid] = &c
		if c.IsDefault {
			// TODO: verify that there will be only 1 default channel.
			defaultChannel = &c
		}
	}

	if defaultChannel == nil {
		// TODO: is this possible?
		defaultChannel = &allChannels[0]
	}

	return allChannelsMap, defaultChannel, nil
}

func (m *migration) makeReceiverAndRoute(ruleUid string, channelUids []string, allChannels map[string]*notificationChannel) (*apimodels.PostableApiReceiver, *config.Route, error) {
	receiverName := getMigratedReceiverNameFromRuleUID(ruleUid)

	portedChannels := []*apimodels.PostableGrafanaReceiver{}
	receiver := &apimodels.PostableApiReceiver{
		Receiver: config.Receiver{
			Name: receiverName,
		},
	}

	for _, n := range channelUids {
		m, ok := allChannels[n]
		if !ok {
			// TODO: should we error out here?
			continue
		}
		portedChannels = append(portedChannels, &apimodels.PostableGrafanaReceiver{
			Name:                  m.Name,
			Type:                  m.Type,
			DisableResolveMessage: m.DisableResolveMessage,
			Settings:              m.Settings,
			SecureSettings:        m.SecureSettings.Decrypt(),
			OrgId:                 m.OrgId,
		})
	}
	receiver.PostableGrafanaReceivers.GrafanaManagedReceivers = portedChannels

	n, v := getLabelForRouteMatching(ruleUid)
	mat, err := labels.NewMatcher(labels.MatchEqual, n, v)
	if err != nil {
		return nil, nil, err
	}
	route := &config.Route{
		Receiver: receiverName,
		Matchers: config.Matchers{mat},
	}

	return receiver, route, nil
}

func getMigratedReceiverNameFromRuleUID(ruleUID string) string {
	return fmt.Sprintf("autogen-panel-recv-%s", ruleUID)
}

func getLabelForRouteMatching(ruleUID string) (string, string) {
	return "rule_uid", ruleUID
}

func getChannelUidsFromDashboard(d oldDash, panelId int64) ([]string, error) {
	channelUids := []string{}

	panels, err := d.Data.Get("panels").Array()
	if err != nil {
		return nil, err
	}

	for _, pi := range panels {
		p := simplejson.NewFromAny(pi)
		pid, err := p.Get("id").Int64()
		if err != nil {
			return nil, err
		}

		if pid != panelId {
			continue
		}

		uids, err := p.Get("notifications").Array()
		if err != nil {
			return nil, err
		}

		for _, ui := range uids {
			u := simplejson.NewFromAny(ui)
			channelUid, err := u.Get("uid").String()
			if err != nil {
				return nil, err
			}

			channelUids = append(channelUids, channelUid)
		}

		break
	}

	return channelUids, nil
}
