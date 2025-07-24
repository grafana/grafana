package historian

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/services/annotations"
)

type failingAnnotationRepo struct{}

func (f *failingAnnotationRepo) SaveMany(_ context.Context, _ []annotations.Item) error {
	return fmt.Errorf("failed to save annotations")
}

func (f *failingAnnotationRepo) Find(_ context.Context, _ *annotations.ItemQuery) ([]*annotations.ItemDTO, error) {
	return nil, fmt.Errorf("failed to query annotations")
}
