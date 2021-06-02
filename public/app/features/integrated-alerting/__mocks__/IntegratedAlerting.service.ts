import * as alertingService from '../IntegratedAlerting.service';

export const IntegratedAlertingService = jest.genMockFromModule<typeof alertingService>('../IntegratedAlerting.service')
  .IntegratedAlertingService;

IntegratedAlertingService.getSettings = () => Promise.resolve({ settings: { alerting_enabled: false } });
