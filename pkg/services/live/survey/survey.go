package survey

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/live/leader"
	"github.com/grafana/grafana/pkg/services/live/orgchannel"

	"github.com/centrifugal/centrifuge"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/live"
	"github.com/grafana/grafana/pkg/services/live/managedstream"
)

var (
	logger = log.New("live.survey")
)

type ChannelHandlerGetter interface {
	GetChannelHandler(ctx context.Context, user *models.SignedInUser, channel string) (models.ChannelHandler, live.Channel, error)
}

type Caller struct {
	channelHandlerGetter ChannelHandlerGetter
	managedStreamRunner  *managedstream.Runner
	bus                  bus.Bus
	node                 *centrifuge.Node
	leaderManager        leader.Manager
}

const (
	managedStreamsCall    = "managed_streams"
	pluginSubscribeStream = "plugin_subscribe_stream"
)

func NewCaller(managedStreamRunner *managedstream.Runner, bus bus.Bus, channelHandlerGetter ChannelHandlerGetter, node *centrifuge.Node, leaderManager leader.Manager) *Caller {
	return &Caller{
		channelHandlerGetter: channelHandlerGetter,
		managedStreamRunner:  managedStreamRunner,
		node:                 node,
		bus:                  bus,
		leaderManager:        leaderManager,
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
	OrgID        int64  `json:"org"`
	UserID       int64  `json:"userId"`
	Channel      string `json:"channel"`
	LeaderNodeID string `json:"leaderNodeId"`
	LeadershipID string `json:"leadershipId"`
}

type PluginSubscribeStreamResponse struct {
	Status backend.SubscribeStreamStatus `json:"status,omitempty"`
	Reply  models.SubscribeReply         `json:"reply"`
}

func (c *Caller) handlePluginSubscribeStream(data []byte) (*PluginSubscribeStreamResponse, error) {
	var req PluginSubscribeStreamRequest
	err := json.Unmarshal(data, &req)
	if err != nil {
		return nil, err
	}
	logger.Debug("Handle plugin subscribe stream survey", "req", req)
	if req.LeaderNodeID != c.node.ID() {
		// TODO: should only send survey to the leader node.
		logger.Debug("Non-leader node")
		return &PluginSubscribeStreamResponse{}, nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 250*time.Millisecond)
	defer cancel()
	ok, _, currentLeadershipID, err := c.leaderManager.GetLeader(ctx, orgchannel.PrependOrgID(req.OrgID, req.Channel))
	if err != nil {
		// TODO: better handling of non-leader error.
		return nil, errors.New("error checking leader")
	}
	if !ok || currentLeadershipID != req.LeadershipID {
		// TODO: better handling of non-leader error.
		return nil, errors.New("error leader changed")
	}

	query := models.GetSignedInUserQuery{UserId: req.UserID, OrgId: req.OrgID}
	if err := c.bus.Dispatch(context.Background(), &query); err != nil {
		// TODO: better handling of auth error.
		return nil, errors.New("unauthorized")
	}
	user := query.Result

	handler, parsedChannel, err := c.channelHandlerGetter.GetChannelHandler(context.Background(), user, req.Channel)
	if err != nil {
		return nil, err
	}

	reply, status, err := handler.OnSubscribe(context.Background(), user, models.SubscribeEvent{
		Channel:      req.Channel,
		Path:         parsedChannel.Path,
		OnLeader:     true,
		LeadershipID: req.LeadershipID,
	})
	if err != nil {
		return nil, err
	}

	return &PluginSubscribeStreamResponse{
		Status: status,
		Reply:  reply,
	}, nil
}

func (c *Caller) CallPluginSubscribeStream(ctx context.Context, user *models.SignedInUser, channel string, leaderNodeID string, leadershipID string) (models.SubscribeReply, backend.SubscribeStreamStatus, error) {
	req := PluginSubscribeStreamRequest{
		OrgID:        user.OrgId,
		UserID:       user.UserId,
		Channel:      channel,
		LeaderNodeID: leaderNodeID,
		LeadershipID: leadershipID,
	}
	jsonData, err := json.Marshal(req)
	if err != nil {
		return models.SubscribeReply{}, 0, err
	}

	resp, err := c.node.Survey(ctx, pluginSubscribeStream, jsonData, leaderNodeID)
	if err != nil {
		return models.SubscribeReply{}, 0, err
	}

	for nodeID, result := range resp {
		if result.Code != 0 {
			return models.SubscribeReply{}, 0, fmt.Errorf("unexpected survey code: %d", result.Code)
		}
		if nodeID != leaderNodeID {
			continue
		}
		var res PluginSubscribeStreamResponse
		err := json.Unmarshal(result.Data, &res)
		if err != nil {
			return models.SubscribeReply{}, 0, err
		}
		return res.Reply, res.Status, nil
	}
	// TODO: maybe handle in a special way.
	return models.SubscribeReply{}, 0, errors.New("leader not responded")
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
