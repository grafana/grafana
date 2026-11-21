package main

import (
	"context"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/rest"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	client "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// grafana holds the clients that talk to a running Grafana's /apis endpoints.
type grafana struct {
	restConfig   *rest.Config
	provisioning client.Interface
	lister       resources.ResourceLister
}

func newGrafana(opts options) (*grafana, error) {
	cfg := &rest.Config{Host: opts.grafanaURL, APIPath: "/apis"}
	if opts.grafanaToken != "" {
		cfg.BearerToken = opts.grafanaToken
	} else {
		cfg.Username = opts.grafanaUser
		cfg.Password = opts.grafanaPassword
	}

	provisioningClient, err := client.NewForConfig(cfg)
	if err != nil {
		return nil, fmt.Errorf("create provisioning client: %w", err)
	}

	restClientCfg := rest.CopyConfig(cfg)
	restClientCfg.GroupVersion = &schema.GroupVersion{Group: provisioning.GROUP, Version: provisioning.VERSION}
	restClientCfg.NegotiatedSerializer = scheme.Codecs.WithoutConversion()
	restClient, err := rest.RESTClientFor(restClientCfg)
	if err != nil {
		return nil, fmt.Errorf("create provisioning REST client: %w", err)
	}

	return &grafana{
		restConfig:   cfg,
		provisioning: provisioningClient,
		lister:       resources.NewResourceListerFromProvisioningAPI(restClient, 0),
	}, nil
}

func (g *grafana) getRepository(ctx context.Context, namespace, name string) (*provisioning.Repository, error) {
	cfg, err := g.provisioning.ProvisioningV0alpha1().Repositories(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("get repository %s/%s: %w", namespace, name, err)
	}
	return cfg, nil
}

func (g *grafana) GetRestConfig(context.Context) (*rest.Config, error) {
	return g.restConfig, nil
}
