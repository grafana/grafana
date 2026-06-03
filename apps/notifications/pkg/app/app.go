package app

import (
	"context"
	"fmt"
	"unicode/utf8"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	notificationsv0alpha1 "github.com/grafana/grafana/apps/notifications/pkg/apis/notifications/v0alpha1"
	"github.com/grafana/grafana/apps/notifications/pkg/apis/manifestdata"
	notificationslive "github.com/grafana/grafana/apps/notifications/pkg/live"
)

const maxExcerptRunes = 280

// Config carries app-level dependencies that are not part of the standard app.Config.
type Config struct {
	// Publisher is optional; when set, Live events are pushed on create/delete.
	Publisher *notificationslive.Publisher
}

func validateNotification(obj *notificationsv0alpha1.Notification) error {
	spec := obj.Spec
	if utf8.RuneCountInString(spec.Excerpt) > maxExcerptRunes {
		return fmt.Errorf("spec.excerpt must be at most %d characters, got %d", maxExcerptRunes, utf8.RuneCountInString(spec.Excerpt))
	}
	if spec.RecipientUID == "" {
		return fmt.Errorf("spec.recipientUID must not be empty")
	}
	if spec.OrgID <= 0 {
		return fmt.Errorf("spec.orgID must be greater than 0")
	}
	return nil
}

func New(cfg app.Config) (app.App, error) {
	validator := &simple.Validator{
		ValidateFunc: func(_ context.Context, req *app.AdmissionRequest) error {
			obj, ok := req.Object.(*notificationsv0alpha1.Notification)
			if !ok {
				return fmt.Errorf("expected *Notification, got %T", req.Object)
			}
			return validateNotification(obj)
		},
	}

	managedKind := simple.AppManagedKind{
		Kind:      notificationsv0alpha1.NotificationKind(),
		Validator: validator,
		ReconcileOptions: simple.BasicReconcileOptions{
			UsePlain: true,
		},
	}

	if appCfg, ok := cfg.SpecificConfig.(*Config); ok && appCfg != nil && appCfg.Publisher != nil {
		pub := appCfg.Publisher
		managedKind.Watcher = &simple.Watcher{
			AddFunc: func(_ context.Context, obj resource.Object) error {
				n, ok := obj.(*notificationsv0alpha1.Notification)
				if !ok {
					return nil
				}
				return pub.PublishCreated(n)
			},
			DeleteFunc: func(_ context.Context, obj resource.Object) error {
				n, ok := obj.(*notificationsv0alpha1.Notification)
				if !ok {
					return nil
				}
				return pub.PublishDeleted(n)
			},
		}
	}

	simpleConfig := simple.AppConfig{
		Name:         "notifications",
		KubeConfig:   cfg.KubeConfig,
		ManagedKinds: []simple.AppManagedKind{managedKind},
	}

	a, err := simple.NewApp(simpleConfig)
	if err != nil {
		return nil, err
	}

	if err = a.ValidateManifest(cfg.ManifestData); err != nil {
		return nil, err
	}

	return a, nil
}

func LocalManifest() app.Manifest {
	return manifestdata.LocalManifest()
}
