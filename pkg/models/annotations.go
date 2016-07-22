package models

import (
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

type AnnotationType string

type AnnotationEvent struct {
	Id        int64
	OrgId     int64
	Type      AnnotationType
	Title     string
	Text      string
	AlertId   int64
	UserId    int64
	Timestamp time.Time

	Data *simplejson.Json
}
