import { alertsStubs } from './alertsStubs';

import * as alertsService from '../Alerts.service';

export const AlertsService = jest.genMockFromModule<typeof alertsService>('../Alerts.service').AlertsService;

AlertsService.list = () => Promise.resolve(alertsStubs);
AlertsService.toggle = () => Promise.resolve();
