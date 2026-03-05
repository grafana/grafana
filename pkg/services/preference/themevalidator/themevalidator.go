package themevalidator

import (
	"context"

	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/resource"
	themeV0alpha1 "github.com/grafana/grafana/apps/theme/pkg/apis/theme/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver"
	apiserverrequest "github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/setting"
)

type Service struct {
	namespacer               apiserverrequest.NamespaceMapper
	clientGenerator          func(ctx context.Context) (*themeV0alpha1.ThemeClient, error)
	userThemeClientGenerator func(ctx context.Context) (*themeV0alpha1.UserThemeClient, error)
}

func ProvideService(
	cfg *setting.Cfg,
	restConfigProvider apiserver.RestConfigProvider,
) pref.ThemeValidator {
	namespacer := apiserverrequest.GetNamespaceMapper(cfg)

	return &Service{
		namespacer: namespacer,
		clientGenerator: func(ctx context.Context) (*themeV0alpha1.ThemeClient, error) {
			kubeConfig, err := restConfigProvider.GetRestConfig(ctx)
			if err != nil {
				return nil, err
			}
			kubeConfig.APIPath = "apis"
			clientGenerator := k8s.NewClientRegistry(*kubeConfig, k8s.ClientConfig{})
			return themeV0alpha1.NewThemeClientFromGenerator(clientGenerator)
		},
		userThemeClientGenerator: func(ctx context.Context) (*themeV0alpha1.UserThemeClient, error) {
			kubeConfig, err := restConfigProvider.GetRestConfig(ctx)
			if err != nil {
				return nil, err
			}
			kubeConfig.APIPath = "apis"
			clientGenerator := k8s.NewClientRegistry(*kubeConfig, k8s.ClientConfig{})
			return themeV0alpha1.NewUserThemeClientFromGenerator(clientGenerator)
		},
	}
}

func (s *Service) IsValidThemeID(ctx context.Context, orgID int64, id string) bool {
	// Fast path: check built-in themes first (no network call)
	if pref.IsValidThemeID(id) {
		return true
	}

	// Slow path: check custom themes via theme app
	if s.getCustomTheme(ctx, orgID, id) != nil {
		return true
	}

	// Check user themes
	return s.getUserTheme(ctx, orgID, id) != nil
}

func (s *Service) GetThemeByID(ctx context.Context, orgID int64, id string) *pref.ThemeDTO {
	// Fast path: check built-in themes first
	if dto := pref.GetThemeByID(id); dto != nil {
		return dto
	}

	// Slow path: fetch from theme app
	if dto := s.getCustomTheme(ctx, orgID, id); dto != nil {
		return dto
	}

	// Check user themes
	return s.getUserTheme(ctx, orgID, id)
}

func (s *Service) getUserTheme(ctx context.Context, orgID int64, id string) *pref.ThemeDTO {
	client, err := s.userThemeClientGenerator(ctx)
	if err != nil {
		return nil
	}

	namespace := s.namespacer(orgID)
	theme, err := client.Get(ctx, resource.Identifier{
		Namespace: namespace,
		Name:      id,
	})
	if err != nil {
		return nil
	}

	themeType := "dark"
	if theme.Spec.Colors != nil && theme.Spec.Colors.Mode != nil {
		themeType = string(*theme.Spec.Colors.Mode)
	}

	return &pref.ThemeDTO{
		ID:      id,
		Type:    themeType,
		IsExtra: true,
	}
}

func (s *Service) getCustomTheme(ctx context.Context, orgID int64, id string) *pref.ThemeDTO {
	client, err := s.clientGenerator(ctx)
	if err != nil {
		return nil
	}

	namespace := s.namespacer(orgID)
	theme, err := client.Get(ctx, resource.Identifier{
		Namespace: namespace,
		Name:      id,
	})
	if err != nil {
		return nil
	}

	// Map the theme app's color mode to the ThemeDTO Type field
	themeType := "dark" // default
	if theme.Spec.Colors != nil && theme.Spec.Colors.Mode != nil {
		themeType = string(*theme.Spec.Colors.Mode)
	}

	return &pref.ThemeDTO{
		ID:      id,
		Type:    themeType,
		IsExtra: true,
	}
}
