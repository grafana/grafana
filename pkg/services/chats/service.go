package chats

import (
	"context"
	"math/rand"
	"os"
	"time"

	"github.com/grafana/grafana/pkg/models"

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
	if os.Getenv("GF_FAKE_ORG_CHAT") != "" {
		go s.fakeChat(context.Background(), ContentTypeOrg, "1")
	}
	return s
}

// Run Service.
func (s *Service) Run(ctx context.Context) error {
	<-ctx.Done()
	return ctx.Err()
}

func (s *Service) fakeChat(ctx context.Context, contentTypeID int, objectID string) {
	tm := time.NewTimer(5 * time.Second)
	defer tm.Stop()
	i := 0
	plusOneReactions := []string{
		"+1",
		"well said",
		"a mug of beer for this gentleman",
	}

	getRandUser := func() int64 {
		userID := rand.Intn(2) + 1
		if i%10 == 0 {
			userID = 0
		}
		return int64(userID)
	}

	for {
		select {
		case <-tm.C:
			var content string
			var needPlusOne bool
			if i%4 == 0 {
				content = gofakeit.Question()
			} else if i%5 == 0 {
				content = gofakeit.Quote() + " " + gofakeit.Emoji()
				needPlusOne = true
			} else {
				content = gofakeit.HackerPhrase()
			}
			_, _ = s.SendMessage(ctx, 1, &models.SignedInUser{UserId: getRandUser(), OrgRole: models.ROLE_ADMIN}, SendMessageCmd{
				ContentTypeId: contentTypeID,
				ObjectId:      objectID,
				Content:       content,
			})
			if needPlusOne {
				time.Sleep(2 * time.Second)
				content = "> " + content + "\n\n" + plusOneReactions[rand.Intn(len(plusOneReactions))] + " " + gofakeit.Emoji()
				_, _ = s.SendMessage(ctx, 1, &models.SignedInUser{UserId: getRandUser(), OrgRole: models.ROLE_ADMIN}, SendMessageCmd{
					ContentTypeId: contentTypeID,
					ObjectId:      objectID,
					Content:       content,
				})
			}
			i++
			delay := rand.Intn(5) + 3
			tm.Reset(time.Duration(delay) * time.Second)
		case <-ctx.Done():
			return
		}
	}
}
