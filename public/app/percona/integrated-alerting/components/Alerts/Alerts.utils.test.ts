import { AlertRuleSeverity } from '../AlertRules/AlertRules.types';
import { Alert } from './Alerts.types';
import { formatAlert, formatAlerts } from './Alerts.utils';
import { alertsStubs } from './__mocks__/alertsStubs';

const moment = jest.requireActual('moment-timezone');
moment.tz.setDefault('UTC');

const expectedAlertResult1: Alert = {
  alertId: '1',
  activeSince: '2020-11-25 16:53:39.366',
  labels: {
    primary: ['environment=prod', 'node_name=pxc_instance1', 'cluster=PXCCluster1', 'service_name=my_db1'],
    secondary: ['app=wordpress'],
  },
  severity: AlertRuleSeverity.SEVERITY_CRITICAL,
  status: 'Firing',
  summary: 'PXC cluster on [HR prod] is down',
  lastNotified: '2020-11-25 16:53:39.366',
};

const expectedAlertResult2: Alert = {
  alertId: '6',
  activeSince: '',
  labels: {
    primary: ['environment=dev', 'node_name=mdb_prod_7', 'cluster=MDBReplicaSet2', 'service_name=mdb_replset1'],
    secondary: ['service_type=mongodb'],
  },
  severity: AlertRuleSeverity.SEVERITY_WARNING,
  status: 'Silenced',
  summary: 'Memory consumption on [Mncfg Dev] instance 1 reached 80%',
  lastNotified: '',
};

describe('AlertRulesTable utils', () => {
  test('formatAlert', () => {
    expect(formatAlert(alertsStubs.alerts[0])).toEqual<Alert>(expectedAlertResult1);

    expect(formatAlert(alertsStubs.alerts[5])).toEqual<Alert>(expectedAlertResult2);
  });

  test('formatAlerts', () => {
    expect(formatAlerts([])).toEqual<Alert[]>([]);

    expect(formatAlerts([alertsStubs.alerts[0], alertsStubs.alerts[5]])).toEqual<Alert[]>([
      expectedAlertResult1,
      expectedAlertResult2,
    ]);
  });
});
