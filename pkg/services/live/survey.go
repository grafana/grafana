package live

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/services/live/managedstream"

	"github.com/centrifugal/centrifuge"
)

type SurveyCaller struct {
	live *GrafanaLive
	node *centrifuge.Node
}

func NewSurveyCaller(live *GrafanaLive, node *centrifuge.Node) *SurveyCaller {
	return &SurveyCaller{live: live, node: node}
}

func (c *SurveyCaller) SetupHandlers() error {
	c.node.OnSurvey(c.handleSurvey)
	return nil
}

type NodeManagedChannelsRequest struct {
	OrgID int64 `json:"orgId"`
}

type NodeManagedChannelsResponse struct {
	Channels []*managedstream.ManagedChannel `json:"channels"`
}

func (c *SurveyCaller) handleSurvey(e centrifuge.SurveyEvent, cb centrifuge.SurveyCallback) {
	var (
		resp interface{}
		err  error
	)
	switch e.Op {
	case "managed_streams":
		resp, err = c.handleManagedStreams(e.Data)
	default:
		err = errors.New("method not found")
	}
	if err != nil {
		cb(centrifuge.SurveyReply{Code: 1})
		return
	}
	jsonData, err := json.Marshal(resp)
	if err != nil {
		cb(centrifuge.SurveyReply{Code: 1})
		return
	}
	cb(centrifuge.SurveyReply{
		Code: 0,
		Data: jsonData,
	})
}

func (c *SurveyCaller) handleManagedStreams(data []byte) (interface{}, error) {
	var req NodeManagedChannelsRequest
	err := json.Unmarshal(data, &req)
	if err != nil {
		return nil, err
	}
	channels, err := c.live.getManagedChannels(req.OrgID)
	if err != nil {
		return nil, err
	}
	return NodeManagedChannelsResponse{
		Channels: channels,
	}, nil
}

func (c *SurveyCaller) CallManagedStreams(orgID int64) ([]*managedstream.ManagedChannel, error) {
	req := NodeManagedChannelsRequest{OrgID: orgID}
	jsonData, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()

	resp, err := c.node.Survey(ctx, "managed_streams", jsonData)
	if err != nil {
		return nil, err
	}

	channels := make([]*managedstream.ManagedChannel, 0)
	duplicatesCheck := map[string]struct{}{}

	for _, result := range resp {
		if result.Code != 0 {
			return nil, fmt.Errorf("unexpected survey code: %d", result.Code)
		}
		var res NodeManagedChannelsResponse
		err := json.Unmarshal(result.Data, &res)
		if err != nil {
			return nil, err
		}
		for _, ch := range res.Channels {
			if _, ok := duplicatesCheck[ch.Channel]; ok {
				continue
			}
			channels = append(channels, ch)
			duplicatesCheck[ch.Channel] = struct{}{}
		}
	}

	return channels, nil
}
