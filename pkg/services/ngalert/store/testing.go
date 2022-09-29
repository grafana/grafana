package store

import (
	"context"
	"math/rand"
	"strings"
	"sync"
	"testing"

	"github.com/grafana/grafana/pkg/util"

	models2 "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func NewFakeImageStore(t *testing.T) *FakeImageStore {
	return &FakeImageStore{
		t:      t,
		images: make(map[string]*models.Image),
	}
}

type FakeImageStore struct {
	t      *testing.T
	mtx    sync.Mutex
	images map[string]*models.Image
}

func (s *FakeImageStore) GetImage(_ context.Context, token string) (*models.Image, error) {
	s.mtx.Lock()
	defer s.mtx.Unlock()
	if image, ok := s.images[token]; ok {
		return image, nil
	}
	return nil, models.ErrImageNotFound
}

func (s *FakeImageStore) GetImages(_ context.Context, tokens []string) ([]models.Image, []string, error) {
	s.mtx.Lock()
	defer s.mtx.Unlock()
	images := make([]models.Image, 0, len(tokens))
	for _, token := range tokens {
		if image, ok := s.images[token]; ok {
			images = append(images, *image)
		}
	}
	if len(images) < len(tokens) {
		return images, unmatchedTokens(tokens, images), models.ErrImageNotFound
	}
	return images, nil, nil
}

func (s *FakeImageStore) SaveImage(_ context.Context, image *models.Image) error {
	s.mtx.Lock()
	defer s.mtx.Unlock()
	if image.ID == 0 {
		image.ID = int64(len(s.images)) + 1
	}
	if image.Token == "" {
		tmp := strings.Split(image.Path, ".")
		image.Token = strings.Join(tmp[:len(tmp)-1], ".")
	}
	s.images[image.Token] = image
	return nil
}

func NewFakeRuleStore(t *testing.T) *FakeRuleStore {
	return &FakeRuleStore{
		t:     t,
		Rules: map[int64][]*models.AlertRule{},
		Hook: func(interface{}) error {
			return nil
		},
		Folders: map[int64][]*models2.Folder{},
	}
}

// PutRule puts the rule in the Rules map. If there are existing rule in the same namespace, they will be overwritten
func (f *FakeRuleStore) PutRule(_ context.Context, rules ...*models.AlertRule) {
	f.mtx.Lock()
	defer f.mtx.Unlock()
mainloop:
	for _, r := range rules {
		rgs := f.Rules[r.OrgID]
		for idx, rulePtr := range rgs {
			if rulePtr.UID == r.UID {
				rgs[idx] = r
				continue mainloop
			}
		}
		rgs = append(rgs, r)
		f.Rules[r.OrgID] = rgs

		var existing *models2.Folder
		folders := f.Folders[r.OrgID]
		for _, folder := range folders {
			if folder.Uid == r.NamespaceUID {
				existing = folder
				break
			}
		}
		if existing == nil {
			folders = append(folders, &models2.Folder{
				Id:    rand.Int63(),
				Uid:   r.NamespaceUID,
				Title: "TEST-FOLDER-" + util.GenerateShortUID(),
			})
			f.Folders[r.OrgID] = folders
		}
	}
}

func NewFakeAdminConfigStore(t *testing.T) *FakeAdminConfigStore {
	t.Helper()
	return &FakeAdminConfigStore{Configs: map[int64]*models.AdminConfiguration{}}
}

type FakeAdminConfigStore struct {
	mtx     sync.Mutex
	Configs map[int64]*models.AdminConfiguration
}

func (f *FakeAdminConfigStore) GetAdminConfiguration(orgID int64) (*models.AdminConfiguration, error) {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	return f.Configs[orgID], nil
}

func (f *FakeAdminConfigStore) GetAdminConfigurations() ([]*models.AdminConfiguration, error) {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	acs := make([]*models.AdminConfiguration, 0, len(f.Configs))
	for _, ac := range f.Configs {
		acs = append(acs, ac)
	}

	return acs, nil
}

func (f *FakeAdminConfigStore) DeleteAdminConfiguration(orgID int64) error {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	delete(f.Configs, orgID)
	return nil
}
func (f *FakeAdminConfigStore) UpdateAdminConfiguration(cmd UpdateAdminConfigurationCmd) error {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	f.Configs[cmd.AdminConfiguration.OrgID] = cmd.AdminConfiguration

	return nil
}
