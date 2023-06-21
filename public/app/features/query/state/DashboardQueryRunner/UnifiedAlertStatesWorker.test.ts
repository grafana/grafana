import { lastValueFrom } from 'rxjs';

import { AlertState, getDefaultTimeRange, TimeRange } from '@grafana/data';
import { backendSrv } from 'app/core/services/backend_srv';
import { disableRBAC, enableRBAC, grantUserPermissions } from 'app/features/alerting/unified/mocks';
import { Annotation } from 'app/features/alerting/unified/utils/constants';
import { createDashboardModelFixture } from 'app/features/dashboard/state/__fixtures__/dashboardFixtures';
import { AccessControlAction } from 'app/types/accessControl';
import { PromAlertingRuleState, PromRuleDTO, PromRulesResponse, PromRuleType } from 'app/types/unified-alerting-dto';

import { silenceConsoleOutput } from '../../../../../test/core/utils/silenceConsoleOutput';
import * as store from '../../../../store/store';

import { UnifiedAlertStatesWorker } from './UnifiedAlertStatesWorker';
import { DashboardQueryRunnerOptions } from './types';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => backendSrv,
}));

function getDefaultOptions(): DashboardQueryRunnerOptions {
  const dashboard = createDashboardModelFixture(
    {
      id: 12345,
      uid: 'a uid',
    },
    {
      publicDashboardAccessToken: '',
    }
  );
  const range = getDefaultTimeRange();

  return { dashboard, range };
}

function getTestContext() {
  jest.clearAllMocks();
  const dispatchMock = jest.spyOn(store, 'dispatch');
  const options = getDefaultOptions();
  const getMock = jest.spyOn(backendSrv, 'get');

  return { getMock, options, dispatchMock };
}

describe('UnifiedAlertStatesWorker', () => {
  const worker = new UnifiedAlertStatesWorker();

  beforeAll(() => {
    disableRBAC();
  });

  describe('when canWork is called with correct props', () => {
    it('then it should return true', () => {
      const options = getDefaultOptions();

      expect(worker.canWork(options)).toBe(true);
    });
  });

  describe('when canWork is called on a public dashboard view', () => {
    it('then it should return false', () => {
      const options = getDefaultOptions();
      options.dashboard.meta.publicDashboardAccessToken = 'abc123';

      expect(worker.canWork(options)).toBe(false);
    });
  });

  describe('when canWork is called with no dashboard id', () => {
    it('then it should return false', () => {
      const dashboard = createDashboardModelFixture({});
      const options = { ...getDefaultOptions(), dashboard };

      expect(worker.canWork(options)).toBe(false);
    });
  });

  describe('when canWork is called with wrong range', () => {
    it('then it should return false', () => {
      const defaultRange = getDefaultTimeRange();
      const range: TimeRange = { ...defaultRange, raw: { ...defaultRange.raw, to: 'now-6h' } };
      const options = { ...getDefaultOptions(), range };

      expect(worker.canWork(options)).toBe(false);
    });
  });

  describe('when run is called with incorrect props', () => {
    it('then it should return the correct results', async () => {
      const { getMock, options } = getTestContext();
      const dashboard = createDashboardModelFixture({});

      await expect(worker.work({ ...options, dashboard })).toEmitValuesWith((received) => {
        expect(received).toHaveLength(1);
        const results = received[0];
        expect(results).toEqual({ alertStates: [], annotations: [] });
        expect(getMock).not.toHaveBeenCalled();
      });
    });
  });

  describe('when run repeatedly for the same dashboard and no alert rules are found', () => {
    it('then canWork should start returning false', async () => {
      const worker = new UnifiedAlertStatesWorker();

      const getResults: PromRulesResponse = {
        status: 'success',
        data: {
          groups: [],
        },
      };
      const { getMock, options } = getTestContext();
      getMock.mockResolvedValue(getResults);
      expect(worker.canWork(options)).toBe(true);
      await lastValueFrom(worker.work(options));
      expect(worker.canWork(options)).toBe(false);
    });
  });

  describe('when run is called with correct props and request is successful', () => {
    function mockPromRuleDTO(overrides: Partial<PromRuleDTO>): PromRuleDTO {
      return {
        alerts: [],
        health: 'ok',
        name: 'foo',
        query: 'foo',
        type: PromRuleType.Alerting,
        state: PromAlertingRuleState.Firing,
        labels: {},
        annotations: {},
        ...overrides,
      };
    }

    it('then it should return the correct results', async () => {
      const getResults: PromRulesResponse = {
        status: 'success',
        data: {
          groups: [
            {
              name: 'group',
              file: '',
              interval: 1,
              rules: [
                mockPromRuleDTO({
                  state: PromAlertingRuleState.Firing,
                  annotations: {
                    [Annotation.dashboardUID]: 'a uid',
                    [Annotation.panelID]: '1',
                  },
                }),
                mockPromRuleDTO({
                  state: PromAlertingRuleState.Inactive,
                  annotations: {
                    [Annotation.dashboardUID]: 'a uid',
                    [Annotation.panelID]: '2',
                  },
                }),
                mockPromRuleDTO({
                  state: PromAlertingRuleState.Pending,
                  annotations: {
                    [Annotation.dashboardUID]: 'a uid',
                    [Annotation.panelID]: '2',
                  },
                }),
              ],
            },
          ],
        },
      };
      const { getMock, options } = getTestContext();
      getMock.mockResolvedValue(getResults);

      await expect(worker.work(options)).toEmitValuesWith((received) => {
        expect(received).toHaveLength(1);
        const results = received[0];
        expect(results).toEqual({
          alertStates: [
            { id: 0, state: AlertState.Alerting, dashboardId: 12345, panelId: 1 },
            { id: 1, state: AlertState.Pending, dashboardId: 12345, panelId: 2 },
          ],
          annotations: [],
        });
      });

      expect(getMock).toHaveBeenCalledTimes(1);
      expect(getMock).toHaveBeenCalledWith(
        '/api/prometheus/grafana/api/v1/rules',
        { dashboard_uid: 'a uid' },
        'dashboard-query-runner-unified-alert-states-12345'
      );
    });
  });

  describe('when run is called with correct props and request fails', () => {
    silenceConsoleOutput();
    it('then it should return the correct results', async () => {
      const { getMock, options, dispatchMock } = getTestContext();
      getMock.mockRejectedValue({ message: 'An error' });

      await expect(worker.work(options)).toEmitValuesWith((received) => {
        expect(received).toHaveLength(1);
        const results = received[0];
        expect(results).toEqual({ alertStates: [], annotations: [] });
        expect(getMock).toHaveBeenCalledTimes(1);
        expect(dispatchMock).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('when run is called with correct props and request is cancelled', () => {
    silenceConsoleOutput();
    it('then it should return the correct results', async () => {
      const { getMock, options, dispatchMock } = getTestContext();
      getMock.mockRejectedValue({ cancelled: true });

      await expect(worker.work(options)).toEmitValuesWith((received) => {
        expect(received).toHaveLength(1);
        const results = received[0];
        expect(results).toEqual({ alertStates: [], annotations: [] });
        expect(getMock).toHaveBeenCalledTimes(1);
        expect(dispatchMock).not.toHaveBeenCalled();
      });
    });
  });
});

describe('UnifiedAlertStateWorker with RBAC', () => {
  beforeAll(() => {
    enableRBAC();
    grantUserPermissions([]);
  });

  it('should not do work with insufficient permissions', () => {
    const worker = new UnifiedAlertStatesWorker();
    const options = getDefaultOptions();

    expect(worker.canWork(options)).toBe(false);
  });

  it('should do work with correct permissions', () => {
    grantUserPermissions([AccessControlAction.AlertingRuleRead, AccessControlAction.AlertingRuleExternalRead]);
    const workerWithPermissions = new UnifiedAlertStatesWorker();

    const options = getDefaultOptions();
    expect(workerWithPermissions.canWork(options)).toBe(true);
  });
});
