package entity

import (
	"github.com/grafana/grafana-plugin-sdk-go/experimental/entity"
	"github.com/grafana/grafana/pkg/services/entity/kind"
)

type EntityService struct {
	Kinds *entity.Kinds
}

func (s *EntityService) init() error {
	k, err := entity.NewKindRegistry(
		// Core types
		//----------------------
		&kind.DashboardKind{},

		// Images
		//----------------------
		entity.NewRawFileKind(
			entity.KindInfo{
				ID:          "png",
				Description: "image",
				FileSuffix:  ".png",
			},
			nil, // could add a sanitizer here
		),
		entity.NewRawFileKind(
			entity.KindInfo{
				ID:          "gif",
				Description: "image",
				FileSuffix:  ".gif",
			},
			nil, // could add a sanitizer here
		),
		entity.NewRawFileKind(
			entity.KindInfo{
				ID:          "webp",
				Description: "image",
				FileSuffix:  ".webp",
			},
			nil, // could add a sanitizer here
		),
		entity.NewRawFileKind(
			entity.KindInfo{
				ID:          "svg",
				Description: "image",
				FileSuffix:  ".svg",
			},
			nil, // could add a sanitizer here
		),
	)
	if err != nil {
		return err
	}
	s.Kinds = k

	return nil
}
