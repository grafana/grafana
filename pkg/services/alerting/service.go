package alerting

import (
	"context"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/encryption"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

type AlertNotificationService struct {
	Bus               bus.Bus
	SQLStore          *sqlstore.SQLStore
	EncryptionService encryption.Service
}

func ProvideService(bus bus.Bus, store *sqlstore.SQLStore, encryptionService encryption.Service,
) *AlertNotificationService {
	s := &AlertNotificationService{
		Bus:               bus,
		SQLStore:          store,
		EncryptionService: encryptionService,
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
	cmd.EncryptedSecureSettings, err = s.EncryptionService.EncryptJsonData(ctx, cmd.SecureSettings, setting.SecretKey)
	if err != nil {
		return err
	}

	model := models.AlertNotification{
		Name:     cmd.Name,
		Type:     cmd.Type,
		Settings: cmd.Settings,
	}

	if err := s.validateAlertNotification(ctx, &model, cmd.SecureSettings); err != nil {
		return err
	}

	return s.SQLStore.CreateAlertNotificationCommand(cmd)
}

func (s *AlertNotificationService) UpdateAlertNotification(ctx context.Context, cmd *models.UpdateAlertNotificationCommand) error {
	var err error
	cmd.EncryptedSecureSettings, err = s.EncryptionService.EncryptJsonData(ctx, cmd.SecureSettings, setting.SecretKey)
	if err != nil {
		return err
	}

	model := models.AlertNotification{
		Id:       cmd.Id,
		Name:     cmd.Name,
		Type:     cmd.Type,
		Settings: cmd.Settings,
	}

	if err := s.validateAlertNotification(ctx, &model, cmd.SecureSettings); err != nil {
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

func (s *AlertNotificationService) createNotifier(ctx context.Context, model *models.AlertNotification, secureSettings map[string]string) (Notifier, error) {
	secureSettingsMap := map[string]string{}

	if model.Id > 0 {
		query := &models.GetAlertNotificationsQuery{
			OrgId: model.OrgId,
			Id:    model.Id,
		}
		if err := s.SQLStore.GetAlertNotifications(query); err != nil {
			return nil, err
		}

		if query.Result != nil && query.Result.SecureSettings != nil {
			var err error
			secureSettingsMap, err = s.EncryptionService.DecryptJsonData(ctx, query.Result.SecureSettings, setting.SecretKey)
			if err != nil {
				return nil, err
			}
		}
	}

	for k, v := range secureSettings {
		secureSettingsMap[k] = v
	}

	var err error
	model.SecureSettings, err = s.EncryptionService.EncryptJsonData(ctx, secureSettingsMap, setting.SecretKey)
	if err != nil {
		return nil, err
	}

	notifier, err := InitNotifier(model, s.EncryptionService.GetDecryptedValue)
	if err != nil {
		logger.Error("Failed to create notifier", "error", err.Error())
		return nil, err
	}

	return notifier, nil
}

func (s *AlertNotificationService) validateAlertNotification(ctx context.Context, model *models.AlertNotification, secureSettings map[string]string) error {
	_, err := s.createNotifier(ctx, model, secureSettings)
	return err
}
