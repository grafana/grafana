import { formatAlert, formatAlerts, formatLabel, formatLabels } from './AlertsTable.utils';
import { alertsStubs } from '../__mocks__/alertsStubs';

const moment = jest.requireActual('moment-timezone');
moment.tz.setDefault('UTC');

const expectedAlertResult1 = {
  alertId: '1',
  activeSince: '2020-11-25 16:53:39.366',
  labels: [
    'environment=prod',
    'app=wordpress',
    'node_name=pxc_instance1',
    'cluster=PXCCluster1',
    'service_name=my_db1',
  ],
  severity: 'Critical',
  status: 'Firing',
  summary: 'PXC cluster on [HR prod] is down',
  lastNotified: '2020-11-25 16:53:39.366',
};

const expectedAlertResult2 = {
  alertId: '6',
  activeSince: '',
  labels: [
    'environment=dev',
    'service_type=mongodb',
    'node_name=mdb_prod_7',
    'cluster=MDBReplicaSet2',
    'service_name=mdb_replset1',
  ],
  severity: 'Warning',
  status: 'Silenced',
  summary: 'Memory consumption on [Mncfg Dev] instance 1 reached 80%',
  lastNotified: '',
};

describe('AlertRulesTable utils', () => {
  test('formatLabel', () => {
    expect(formatLabel(['testKey', '1337'])).toEqual('testKey=1337');
  });

  test('formatLabels', () => {
    expect(formatLabels({})).toEqual([]);
    expect(formatLabels({ testKey: '1337', testKey2: 'testValue' })).toEqual(['testKey=1337', 'testKey2=testValue']);
  });

  test('formatAlert', () => {
    expect(formatAlert(alertsStubs[0])).toEqual(expectedAlertResult1);

    expect(formatAlert(alertsStubs[5])).toEqual(expectedAlertResult2);
  });

  test('formatAlerts', () => {
    expect(formatAlerts(undefined)).toEqual([]);

    expect(formatAlerts(null)).toEqual([]);

    expect(formatAlerts([])).toEqual([]);

    expect(formatAlerts([alertsStubs[0], alertsStubs[5]])).toEqual([expectedAlertResult1, expectedAlertResult2]);
  });
});
