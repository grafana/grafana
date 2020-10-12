package alerting

import "github.com/grafana/grafana/pkg/models"

type validatorSeverity int

const (
	alertWarning validatorSeverity = iota
	alertError
)

type alertValidator struct {
	aFunc     func(*models.Alert) error
	aSeverity validatorSeverity
}
