import * as alertsService from '../Alerts.service';

import { alertsStubs } from './alertsStubs';

export const AlertsService = jest.genMockFromModule<typeof alertsService>('../Alerts.service').AlertsService;

AlertsService.list = () => Promise.resolve(alertsStubs);
AlertsService.toggle = () => Promise.resolve();
