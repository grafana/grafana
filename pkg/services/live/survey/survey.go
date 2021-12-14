package survey

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/live"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"

	"github.com/centrifugal/centrifuge"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/services/live/managedstream"
)

type ChannelHandlerGetter interface {
	GetChannelHandler(user *models.SignedInUser, channel string) (models.ChannelHandler, live.Channel, error)
}

type Caller struct {
	channelHandlerGetter ChannelHandlerGetter
	managedStreamRunner  *managedstream.Runner
	bus                  bus.Bus
	node                 *centrifuge.Node
}

const (
	managedStreamsCall    = "managed_streams"
	pluginSubscribeStream = "plugin_subscribe_stream"
)

func NewCaller(managedStreamRunner *managedstream.Runner, bus bus.Bus, channelHandlerGetter ChannelHandlerGetter, node *centrifuge.Node) *Caller {
	return &Caller{
		channelHandlerGetter: channelHandlerGetter,
		managedStreamRunner:  managedStreamRunner,
		node:                 node,
		bus:                  bus,
	}
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
	case pluginSubscribeStream:
		resp, err = c.handlePluginSubscribeStream(e.Data)
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

type PluginSubscribeStreamRequest struct {
	OrgID   int64  `json:"org"`
	UserID  int64  `json:"userId"`
	Channel string `json:"channel"`
}

type PluginSubscribeStreamResponse struct {
	Status backend.SubscribeStreamStatus `json:"status,omitempty"`
}

func (c *Caller) handlePluginSubscribeStream(data []byte) (*PluginSubscribeStreamResponse, error) {
	var req PluginSubscribeStreamRequest
	err := json.Unmarshal(data, &req)
	if err != nil {
		return nil, err
	}
	query := models.GetSignedInUserQuery{UserId: req.UserID, OrgId: req.OrgID}
	if err := c.bus.DispatchCtx(context.Background(), &query); err != nil {
		// TODO: better handling of auth error.
		return nil, errors.New("unauthorized")
	}
	user := query.Result

	handler, parsedChannel, err := c.channelHandlerGetter.GetChannelHandler(user, req.Channel)
	if err != nil {
		return nil, err
	}

	// TODO: handle reply also.
	_, status, err := handler.OnSubscribe(context.Background(), user, models.SubscribeEvent{
		Channel: req.Channel,
		Path:    parsedChannel.Path,
	})
	if err != nil {
		return nil, err
	}

	return &PluginSubscribeStreamResponse{
		Status: status,
	}, nil
}

func (c *Caller) CallPluginSubscribeStream(orgID int64, user *models.SignedInUser, channel string, toNodeID string) (backend.SubscribeStreamStatus, error) {
	req := PluginSubscribeStreamRequest{
		OrgID:   orgID,
		UserID:  user.UserId,
		Channel: channel,
	}
	jsonData, err := json.Marshal(req)
	if err != nil {
		return 0, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()

	resp, err := c.node.Survey(ctx, pluginSubscribeStream, jsonData)
	if err != nil {
		return 0, err
	}

	for nodeID, result := range resp {
		if result.Code != 0 {
			return 0, fmt.Errorf("unexpected survey code: %d", result.Code)
		}
		if nodeID != toNodeID {
			continue
		}
		var res PluginSubscribeStreamResponse
		err := json.Unmarshal(result.Data, &res)
		if err != nil {
			return 0, err
		}
		return res.Status, nil
	}
	// TODO: maybe handle in a special way.
	return 0, errors.New("leader not responded")
}

func (c *Caller) CallManagedStreams(orgID int64) ([]*managedstream.ManagedChannel, error) {
	req := NodeManagedChannelsRequest{OrgID: orgID}
	jsonData, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()

	resp, err := c.node.Survey(ctx, managedStreamsCall, jsonData)
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
