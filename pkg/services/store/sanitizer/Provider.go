package sanitizer

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/services/rendering"
)

// workaround for cyclic dep between the store and the renderer

type Provider struct{}

var SanitizeSVG = func(ctx context.Context, req *rendering.SanitizeSVGRequest) (*rendering.SanitizeSVGResponse, error) {
	return nil, errors.New("not implemented")
}

func ProvideService(
	renderer rendering.Service,
) *Provider {
	SanitizeSVG = renderer.SanitizeSVG
	return &Provider{}
}
