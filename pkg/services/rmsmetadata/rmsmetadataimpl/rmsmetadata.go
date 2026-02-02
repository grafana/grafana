package rmsmetadataimpl

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/url"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/rmsmetadata"
	metadata "github.com/grafana/grafana/pkg/services/rmsmetadata"
	"github.com/grafana/grafana/pkg/setting"
)

type Service struct {
	store store
	cfg   *setting.Cfg
	log   log.Logger
}

func ProvideService(db db.DB, cfg *setting.Cfg, quotaService quota.Service) (metadata.Service, error) {
	log := log.New("metadata service")
	s := &Service{
		store: &sqlStore{
			db:      db,
			dialect: db.GetDialect(),
			log:     log,
			cfg:     cfg,
		},
		cfg: cfg,
		log: log,
	}

	return s, nil
}

// DB Operations
func (s *Service) GetViewList(ctx context.Context, orgID int64) ([]*rmsmetadata.View, error) {
	return s.store.GetView(ctx, orgID)
}

func (s *Service) GetViewById(ctx context.Context, orgID int64, viewID int64) (*rmsmetadata.View, error) {
	return s.store.GetViewById(ctx, orgID, viewID)
}

func (s *Service) GetViewsEnabledForInsightFinder(ctx context.Context, orgID int64) (*rmsmetadata.ViewsEnabledForInsightFinder, error) {
	return s.store.GetViewsEnabledForInsightFinder(ctx, orgID)
}

func (s *Service) SetViewsEnabledForInsightFinder(ctx context.Context, orgID int64, viewsEnabled *rmsmetadata.ViewsEnabledForInsightFinder) error {
	return s.store.SetViewsEnabledForInsightFinder(ctx, orgID, viewsEnabled)
}

// RMS Operations
func (c *Service) Get(path string, headers map[string]string, queryParamsMap map[string]string) ([]byte, error) {
	Url, _ := url.Parse(path)
	queryParams := Url.Query()
	for key, value := range queryParamsMap {
		queryParams.Add(key, value)
	}
	Url.RawQuery = queryParams.Encode()
	req, err := http.NewRequest("GET", Url.String(), nil)
	if err != nil {
		return nil, err
	}
	for key, value := range headers {
		req.Header.Add(key, value)
	}
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		if resp.Body != nil {
			body, _ := io.ReadAll(resp.Body)
			return body, metadata.ErrRestUnexpected
		}
		return nil, metadata.ErrRestUnexpected
	}
	return io.ReadAll(resp.Body)
}

func (c *Service) Post(path string, headers map[string]string, queryParamsMap map[string]string, data []byte) ([]byte, error) {
	Url, _ := url.Parse(path)
	queryParams := Url.Query()
	for key, value := range queryParamsMap {
		queryParams.Add(key, value)
	}
	Url.RawQuery = queryParams.Encode()
	req, err := http.NewRequest("POST", Url.String(), bytes.NewBuffer(data))
	if err != nil {
		return nil, err
	}
	for key, value := range headers {
		req.Header.Add(key, value)
	}
	req.Header.Add("Content-Type", "application/json")
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		if resp.Body != nil {
			body, _ := io.ReadAll(resp.Body)
			return body, metadata.ErrRestUnexpected
		}
		return nil, metadata.ErrRestUnexpected
	}
	return io.ReadAll(resp.Body)
}

func (c *Service) Delete(path string, headers map[string]string, queryParamsMap map[string]string) error {
	Url, _ := url.Parse(path)
	queryParams := Url.Query()
	for key, value := range queryParamsMap {
		queryParams.Add(key, value)
	}
	Url.RawQuery = queryParams.Encode()
	req, err := http.NewRequest("DELETE", Url.String(), nil)
	if err != nil {
		return err
	}
	for key, value := range headers {
		req.Header.Add(key, value)
	}
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}
