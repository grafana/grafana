package models

import (
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
)

type AlertNotification models.AlertNotification

type Notifier alerting.NotifierPlugin
