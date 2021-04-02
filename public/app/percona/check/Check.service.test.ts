import { makeApiUrl, processData, sumFailedChecks } from './Check.service';
import { Alert } from './types';
import { API } from 'app/percona/shared/core';
import { activeCheckStub, alertsStub } from './__mocks__/stubs';

jest.mock('axios');

describe('CheckService::', () => {
  it('should properly convert Alerts to ActiveChecks', () => {
    const activeChecks = processData(alertsStub as Alert[]);

    expect(activeChecks).toEqual(activeCheckStub);
  });

  it('should properly convert Alerts to a total of FailedChecks', () => {
    const failedChecks = sumFailedChecks(processData(alertsStub as Alert[]));

    expect(failedChecks).toEqual([1, 3, 1]);
  });

  it('should create a url for Alertmanager', () => {
    const url = makeApiUrl('status');

    expect(url).toEqual(`${API.ALERTMANAGER}/status`);
  });
});
