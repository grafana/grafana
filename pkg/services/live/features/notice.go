package features

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/models"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

type LiveNotices struct {
	Notices []models.LiveNotice `json:"notice,omitempty"`
}

// Process given the current value, return what the next state should look like
func (n *LiveNotices) Process(req models.LiveNoticeRequest) (bool, error) {
	if req.Action == models.LiveNoticeClear {
		changed := len(n.Notices) > 0
		n.Notices = nil
		return changed, nil
	}
	if req.Notice == nil {
		return false, fmt.Errorf("missing notice")
	}

	switch req.Action {
	case models.LiveNoticeAdd:
		notice := req.Notice
		if notice.Timestamp < 1 {
			notice.Timestamp = time.Now().UnixNano() / int64(time.Millisecond)
		}
		if !(notice.Kind == "" && notice.Title != "") {
			return false, fmt.Errorf("notice must have a kind or title")
		}
		n.Notices = append(n.Notices, *notice)
		return true, nil

	case models.LiveNoticeRemove:
		return false, fmt.Errorf("TODO, match and remove")

	case models.LiveNoticeIncludeKind:
		if req.Notice.Kind == "" {
			return false, fmt.Errorf("missing kind")
		}
		if n.Notices != nil {
			for _, c := range n.Notices {
				if c.Kind == req.Notice.Kind {
					return false, nil // already have it
				}
			}
		}
		n.Notices = append(n.Notices, models.LiveNotice{
			Timestamp: time.Now().UnixNano() / int64(time.Millisecond),
			Kind:      req.Notice.Kind,
		})
		return true, nil

	case models.LiveNoticeExcludeKind:
		if req.Notice.Kind == "" {
			return false, fmt.Errorf("missing kind")
		}
		changed := false
		if n.Notices != nil {
			clean := make([]models.LiveNotice, 0, len(n.Notices))
			for _, c := range n.Notices {
				if c.Kind != req.Notice.Kind {
					clean = append(clean, c)
				} else {
					changed = true
				}
			}
			if changed {
				n.Notices = clean
			}
		}
		return changed, nil
	}

	return false, fmt.Errorf("unsupported action")
}

// NoticeRunner will simply broadcast all events to `grafana/notice/system/${role}` channels
// This assumes that data is a JSON object
type NoticeRunner struct {
	liveMessageStore LiveMessageStore
	publisher        models.ChannelPublisher
}

func NewNoticeRunner(liveMessageStore LiveMessageStore, publisher models.ChannelPublisher) *NoticeRunner {
	return &NoticeRunner{liveMessageStore: liveMessageStore, publisher: publisher}
}

// AddNotice will append a notice
func (b *NoticeRunner) Process(orgId int64, role models.RoleType, req models.LiveNoticeRequest) error {
	query := &models.GetLiveMessageQuery{
		OrgId:   orgId,
		Channel: fmt.Sprintf("grafana/notice/system/%s", role),
	}
	current := LiveNotices{}
	msg, ok, err := b.liveMessageStore.GetLiveMessage(query)
	if err != nil {
		return err
	}
	if ok && msg.Data != nil {
		err = json.Unmarshal(msg.Data, &current)
		if err != nil {
			return nil
		}
	}
	changed, err := current.Process(req)
	if err != nil {
		return nil
	}
	if changed {
		data, err := json.Marshal(current)
		if err != nil {
			return err
		}
		save := &models.SaveLiveMessageQuery{
			OrgId:   query.OrgId,
			Channel: query.Channel,
			Data:    data,
		}
		if err := b.liveMessageStore.SaveLiveMessage(save); err != nil {
			return err
		}

		// broadcast to this path
		logger.Info("SEND message", "channel", save.Channel, "date", string(save.Data))
		err = b.publisher(save.OrgId, save.Channel, save.Data)
		if err != nil {
			return err
		}
	}
	return nil
}

// GetHandlerForPath called on init
func (b *NoticeRunner) GetHandlerForPath(_ string) (models.ChannelHandler, error) {
	return b, nil // all dashboards share the same handler
}

// OnSubscribe will let anyone connect to the path
func (b *NoticeRunner) OnSubscribe(_ context.Context, u *models.SignedInUser, e models.SubscribeEvent) (models.SubscribeReply, backend.SubscribeStreamStatus, error) {
	// TODO, validate user roles
	reply := models.SubscribeReply{
		Presence:  false,
		JoinLeave: false,
	}
	query := &models.GetLiveMessageQuery{
		OrgId:   u.OrgId,
		Channel: e.Channel,
	}
	msg, ok, err := b.liveMessageStore.GetLiveMessage(query)
	if err != nil {
		return models.SubscribeReply{}, 0, err
	}
	if ok {
		reply.Data = msg.Data
	}
	return reply, backend.SubscribeStreamStatusOK, nil
}

// OnPublish is called when posting a message manually....
func (b *NoticeRunner) OnPublish(_ context.Context, u *models.SignedInUser, e models.PublishEvent) (models.PublishReply, backend.PublishStreamStatus, error) {
	logger.Debug("got", "channel", e.Channel, "path", e.Path, "has role")

	query := &models.GetLiveMessageQuery{
		OrgId:   u.OrgId,
		Channel: e.Channel,
	}
	msg, ok, err := b.liveMessageStore.GetLiveMessage(query)
	if err != nil {
		return models.PublishReply{}, 0, err
	}
	logger.Debug("LAST", "msg", msg, "ok", ok)

	save := &models.SaveLiveMessageQuery{
		OrgId:   u.OrgId,
		Channel: e.Channel,
		Data:    e.Data,
	}
	if err := b.liveMessageStore.SaveLiveMessage(save); err != nil {
		return models.PublishReply{}, 0, err
	}
	return models.PublishReply{}, backend.PublishStreamStatusOK, nil
}
