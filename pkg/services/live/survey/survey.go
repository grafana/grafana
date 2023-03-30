package survey

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/centrifugal/centrifuge"

	"github.com/grafana/grafana/pkg/services/live/managedstream"
)

type Caller struct {
	managedStreamRunner *managedstream.Runner
	node                *centrifuge.Node
}

const (
	managedStreamsCall = "managed_streams"
)

func NewCaller(managedStreamRunner *managedstream.Runner, node *centrifuge.Node) *Caller {
	return &Caller{managedStreamRunner: managedStreamRunner, node: node}
}

func (c *Caller) SetupHandlers() error {
	c.node.OnSurvey(c.handleSurvey)
	return nil
}

type NodeManagedChannelsRequest struct {
	OrgID int64 `json:"orgId"`
}

type NodeManagedChannelsResponse struct {
	Channels []*managedstream.ManagedChannel `json:"channels"`
}

func (c *Caller) handleSurvey(e centrifuge.SurveyEvent, cb centrifuge.SurveyCallback) {
	var (
		resp interface{}
		err  error
	)
	switch e.Op {
	case managedStreamsCall:
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

func (c *Caller) handleManagedStreams(data []byte) (interface{}, error) {
	var req NodeManagedChannelsRequest
	err := json.Unmarshal(data, &req)
	if err != nil {
		return nil, err
	}
	channels, err := c.managedStreamRunner.GetManagedChannels(req.OrgID)
	if err != nil {
		return nil, err
	}
	return NodeManagedChannelsResponse{
		Channels: channels,
	}, nil
}

func (c *Caller) CallManagedStreams(orgID int64) ([]*managedstream.ManagedChannel, error) {
	req := NodeManagedChannelsRequest{OrgID: orgID}
	jsonData, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()

	resp, err := c.node.Survey(ctx, managedStreamsCall, jsonData, "")
	if err != nil {
		return nil, err
	}

	channels := map[string]*managedstream.ManagedChannel{}

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
			if _, ok := channels[ch.Channel]; ok {
				if strings.HasPrefix(ch.Channel, "plugin/testdata/") {
					// Skip adding testdata rates since it works over different
					// mechanism (plugin stream) and the minute rate is hardcoded.
					continue
				}
				channels[ch.Channel].MinuteRate += ch.MinuteRate
				continue
			}
			channels[ch.Channel] = ch
		}
	}

	result := make([]*managedstream.ManagedChannel, 0, len(channels))
	for _, v := range channels {
		result = append(result, v)
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].Channel < result[j].Channel
	})

	return result, nil
}
