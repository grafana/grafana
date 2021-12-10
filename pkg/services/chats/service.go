package chats

import (
	"context"
	"math/rand"
	"os"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/services/live"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/brianvoe/gofakeit/v6"
)

type Service struct {
	cfg     *setting.Cfg
	bus     bus.Bus
	live    *live.GrafanaLive
	storage Storage
}

func ProvideService(cfg *setting.Cfg, bus bus.Bus, store *sqlstore.SQLStore, live *live.GrafanaLive) *Service {
	s := &Service{
		cfg:  cfg,
		bus:  bus,
		live: live,
		storage: &sqlStorage{
			sql: store,
		},
	}
	if os.Getenv("GF_CHAT_FAKE") != "" {
		go s.fakeChat(context.Background())
	}
	return s
}

// Run Service.
func (s *Service) Run(ctx context.Context) error {
	<-ctx.Done()
	return ctx.Err()
}

func (s *Service) fakeChat(ctx context.Context) {
	tm := time.NewTimer(5 * time.Second)
	defer tm.Stop()
	i := 0
	for {
		select {
		case <-tm.C:
			userID := rand.Intn(2) + 1
			if i%10 == 0 {
				userID = 0
			}
			var content string
			if i%4 == 0 {
				content = gofakeit.Question()
			} else if i%5 == 0 {
				content = gofakeit.Quote() + " " + gofakeit.Emoji()
			} else {
				content = gofakeit.HackerPhrase()
			}
			_, err := s.SendMessage(ctx, 1, int64(userID), SendMessageCmd{
				ContentTypeId: ContentTypeTeam,
				ObjectId:      "all",
				Content:       content,
			})
			if err != nil {
				println(err.Error())
			}
			i++
			delay := rand.Intn(5) + 1
			tm.Reset(time.Duration(delay) * time.Second)
		case <-ctx.Done():
			return
		}
	}
}
