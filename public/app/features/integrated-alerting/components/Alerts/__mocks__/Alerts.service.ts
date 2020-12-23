import { alertsStubs } from './alertsStubs';

import * as alertsService from '../Alerts.service';

export const AlertsService = jest.genMockFromModule<typeof alertsService>('../Alerts.service').AlertsService;

AlertsService.list = () => Promise.resolve({ alerts: alertsStubs });
AlertsService.toggle = () => Promise.resolve();
