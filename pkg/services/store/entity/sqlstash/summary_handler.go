package sqlstash

import (
	"encoding/json"

	"github.com/grafana/grafana/pkg/models"
)

type summarySupport struct {
	model       *models.EntitySummary
	name        string
	description *string // null or empty
	slug        *string // null or empty
	folder      *string // null or empty
	labels      *string
	fields      *string
	errors      *string // should not allow saving with this!
	marshaled   []byte
}

func newSummarySupport(summary *models.EntitySummary) (*summarySupport, error) {
	var err error
	var js []byte
	s := &summarySupport{
		model: summary,
	}
	if summary != nil {
		s.marshaled, err = json.Marshal(summary)
		if err != nil {
			return s, err
		}

		s.name = summary.Name
		if summary.Description != "" {
			s.description = &summary.Description
		}
		if summary.Slug != "" {
			s.slug = &summary.Slug
		}
		if summary.Folder != "" {
			s.folder = &summary.Folder
		}
		if len(summary.Labels) > 0 {
			js, err = json.Marshal(summary.Labels)
			if err != nil {
				return s, err
			}
			str := string(js)
			s.labels = &str
		}

		if len(summary.Fields) > 0 {
			js, err = json.Marshal(summary.Fields)
			if err != nil {
				return s, err
			}
			str := string(js)
			s.fields = &str
		}

		if summary.Error != nil {
			js, err = json.Marshal(summary.Error)
			if err != nil {
				return s, err
			}
			str := string(js)
			s.errors = &str
		}
	}
	return s, err
}

func (s summarySupport) toEntitySummary() (*models.EntitySummary, error) {
	var err error
	summary := &models.EntitySummary{
		Name: s.name,
	}
	if s.description != nil {
		summary.Description = *s.description
	}
	if s.slug != nil {
		summary.Slug = *s.slug
	}
	if s.folder != nil {
		summary.Folder = *s.folder
	}
	if s.labels != nil {
		b := []byte(*s.labels)
		err = json.Unmarshal(b, &summary.Labels)
		if err != nil {
			return summary, err
		}
	}
	if s.fields != nil {
		b := []byte(*s.fields)
		err = json.Unmarshal(b, &summary.Fields)
		if err != nil {
			return summary, err
		}
	}
	if s.errors != nil {
		b := []byte(*s.errors)
		err = json.Unmarshal(b, &summary.Error)
		if err != nil {
			return summary, err
		}
	}
	return summary, err
}
