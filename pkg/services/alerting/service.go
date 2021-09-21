package alerting

import (
	"context"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type AlertNotificationService struct {
	Bus            bus.Bus
	SQLStore       *sqlstore.SQLStore
	SecretsService secrets.SecretsService
}

func ProvideService(bus bus.Bus, store *sqlstore.SQLStore, secretsService secrets.SecretsService,
) *AlertNotificationService {
	s := &AlertNotificationService{
		Bus:            bus,
		SQLStore:       store,
		SecretsService: secretsService,
	}

	s.Bus.AddHandler(s.GetAlertNotifications)
	s.Bus.AddHandlerCtx(s.CreateAlertNotificationCommand)
	s.Bus.AddHandlerCtx(s.UpdateAlertNotification)
	s.Bus.AddHandler(s.DeleteAlertNotification)
	s.Bus.AddHandler(s.GetAllAlertNotifications)
	s.Bus.AddHandlerCtx(s.GetOrCreateAlertNotificationState)
	s.Bus.AddHandlerCtx(s.SetAlertNotificationStateToCompleteCommand)
	s.Bus.AddHandlerCtx(s.SetAlertNotificationStateToPendingCommand)
	s.Bus.AddHandler(s.GetAlertNotificationsWithUid)
	s.Bus.AddHandler(s.UpdateAlertNotificationWithUid)
	s.Bus.AddHandler(s.DeleteAlertNotificationWithUid)
	s.Bus.AddHandler(s.GetAlertNotificationsWithUidToSend)
	s.Bus.AddHandlerCtx(s.HandleNotificationTestCommand)

	return s
}

func (s *AlertNotificationService) GetAlertNotifications(query *models.GetAlertNotificationsQuery) error {
	return s.SQLStore.GetAlertNotifications(query)
}

func (s *AlertNotificationService) CreateAlertNotificationCommand(ctx context.Context, cmd *models.CreateAlertNotificationCommand) error {
	var err error
	cmd.EncryptedSecureSettings, err = s.SecretsService.EncryptJsonData(ctx, cmd.SecureSettings, secrets.WithoutScope())
	if err != nil {
		return err
	}

	return s.SQLStore.CreateAlertNotificationCommand(cmd)
}

func (s *AlertNotificationService) UpdateAlertNotification(ctx context.Context, cmd *models.UpdateAlertNotificationCommand) error {
	var err error
	cmd.EncryptedSecureSettings, err = s.SecretsService.EncryptJsonData(ctx, cmd.SecureSettings, secrets.WithoutScope())
	if err != nil {
		return err
	}

	return s.SQLStore.UpdateAlertNotification(cmd)
}

func (s *AlertNotificationService) DeleteAlertNotification(cmd *models.DeleteAlertNotificationCommand) error {
	return s.SQLStore.DeleteAlertNotification(cmd)
}

func (s *AlertNotificationService) GetAllAlertNotifications(query *models.GetAllAlertNotificationsQuery) error {
	return s.SQLStore.GetAllAlertNotifications(query)
}

func (s *AlertNotificationService) GetOrCreateAlertNotificationState(ctx context.Context, cmd *models.GetOrCreateNotificationStateQuery) error {
	return s.SQLStore.GetOrCreateAlertNotificationState(ctx, cmd)
}

func (s *AlertNotificationService) SetAlertNotificationStateToCompleteCommand(ctx context.Context, cmd *models.SetAlertNotificationStateToCompleteCommand) error {
	return s.SQLStore.SetAlertNotificationStateToCompleteCommand(ctx, cmd)
}

func (s *AlertNotificationService) SetAlertNotificationStateToPendingCommand(ctx context.Context, cmd *models.SetAlertNotificationStateToPendingCommand) error {
	return s.SQLStore.SetAlertNotificationStateToPendingCommand(ctx, cmd)
}

func (s *AlertNotificationService) GetAlertNotificationsWithUid(query *models.GetAlertNotificationsWithUidQuery) error {
	return s.SQLStore.GetAlertNotificationsWithUid(query)
}

func (s *AlertNotificationService) UpdateAlertNotificationWithUid(cmd *models.UpdateAlertNotificationWithUidCommand) error {
	return s.SQLStore.UpdateAlertNotificationWithUid(cmd)
}

func (s *AlertNotificationService) DeleteAlertNotificationWithUid(cmd *models.DeleteAlertNotificationWithUidCommand) error {
	return s.SQLStore.DeleteAlertNotificationWithUid(cmd)
}

func (s *AlertNotificationService) GetAlertNotificationsWithUidToSend(query *models.GetAlertNotificationsWithUidToSendQuery) error {
	return s.SQLStore.GetAlertNotificationsWithUidToSend(query)
}
