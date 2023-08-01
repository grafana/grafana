package store

import (
	"context"
	"strings"
	"sync"
	"testing"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func NewFakeImageStore(t *testing.T, images ...*models.Image) *FakeImageStore {
	imageMap := make(map[string]*models.Image)
	for _, image := range images {
		imageMap[image.Token] = image
	}

	return &FakeImageStore{
		t:      t,
		images: imageMap,
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

func (s *FakeImageStore) GetImageByURL(_ context.Context, url string) (*models.Image, error) {
	s.mtx.Lock()
	defer s.mtx.Unlock()
	for _, image := range s.images {
		if image.URL == url {
			return image, nil
		}
	}

	return nil, models.ErrImageNotFound
}

func (s *FakeImageStore) URLExists(_ context.Context, url string) (bool, error) {
	s.mtx.Lock()
	defer s.mtx.Unlock()
	for _, image := range s.images {
		if image.URL == url {
			return true, nil
		}
	}
	return false, nil
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
