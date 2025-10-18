import { lastValueFrom } from 'rxjs';

import { AlertState, getDefaultTimeRange, TimeRange } from '@grafana/data';
import { config } from '@grafana/runtime';

import { backendSrv } from 'app/core/services/backend_srv';
import {
  grantUserPermissions,
  mockPromAlertingRule,
  mockPromRuleGroup,
  mockPromRuleNamespace,
} from 'app/features/alerting/unified/mocks';
import { Annotation } from 'app/features/alerting/unified/utils/constants';
import { createDashboardModelFixture } from 'app/features/dashboard/state/__fixtures__/dashboardFixtures';
import { AccessControlAction } from 'app/types/accessControl';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

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
    {}
  );
  const range = getDefaultTimeRange();

  return { dashboard, range };
}

function getTestContext() {
  jest.clearAllMocks();
  const dispatchMock = jest.spyOn(store, 'dispatch');
  const options = getDefaultOptions();

  return { options, dispatchMock };
}

describe('UnifiedAlertStatesWorker', () => {
  const worker = new UnifiedAlertStatesWorker();

  beforeEach(() => {
    config.publicDashboardAccessToken = '';
    grantUserPermissions(Object.values(AccessControlAction));
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
      config.publicDashboardAccessToken = 'abc123';

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
      const { options } = getTestContext();
      const dashboard = createDashboardModelFixture({});

      await expect(worker.work({ ...options, dashboard })).toEmitValuesWith((received) => {
        expect(received).toHaveLength(1);
        const results = received[0];
        expect(results).toEqual({ alertStates: [], annotations: [] });
      });
    });
  });

  describe('when run repeatedly for the same dashboard and no alert rules are found', () => {
    const nameSpaces = [mockPromRuleNamespace({ groups: [] })];
    const { dispatchMock, options } = getTestContext();
    dispatchMock.mockResolvedValue(nameSpaces);
    it('then canWork should start returning false', async () => {
      const worker = new UnifiedAlertStatesWorker();
      expect(worker.canWork(options)).toBe(true);
      await lastValueFrom(worker.work(options));
      expect(worker.canWork(options)).toBe(false);
    });
  });

  describe('when run is called with correct props and request is successful', () => {
    it('then it should return the correct results', async () => {
      const nameSpaces = [
        mockPromRuleNamespace({
          groups: [
            mockPromRuleGroup({
              name: 'group1',
              rules: [
                mockPromAlertingRule({
                  name: 'alert1',
                  state: PromAlertingRuleState.Firing,
                  annotations: {
                    [Annotation.dashboardUID]: 'a uid',
                    [Annotation.panelID]: '1',
                  },
                }),
              ],
            }),
            mockPromRuleGroup({
              name: 'group2',
              rules: [
                mockPromAlertingRule({
                  name: 'alert2',
                  state: PromAlertingRuleState.Inactive,
                  annotations: {
                    [Annotation.dashboardUID]: 'a uid',
                    [Annotation.panelID]: '2',
                  },
                }),
              ],
            }),
            mockPromRuleGroup({
              name: 'group3',
              rules: [
                mockPromAlertingRule({
                  name: 'alert3',
                  state: PromAlertingRuleState.Pending,
                  annotations: {
                    [Annotation.dashboardUID]: 'a uid',
                    [Annotation.panelID]: '2',
                  },
                }),
              ],
            }),
          ],
        }),
      ];
      const { dispatchMock, options } = getTestContext();
      dispatchMock.mockResolvedValue({ data: nameSpaces });

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

      expect(dispatchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('when run is called with correct props and request fails', () => {
    silenceConsoleOutput();
    it('then it should return the correct results', async () => {
      const { options, dispatchMock } = getTestContext();
      dispatchMock.mockResolvedValue({ error: 'An error' });

      await expect(worker.work(options)).toEmitValuesWith((received) => {
        expect(received).toHaveLength(1);
        const results = received[0];
        expect(results).toEqual({ alertStates: [], annotations: [] });
      });
    });
  });
  describe('when run is called with correct props and request is cancelled', () => {
    silenceConsoleOutput();
    it('then it should return the correct results', async () => {
      const { options, dispatchMock } = getTestContext();
      dispatchMock.mockResolvedValue({ error: { message: 'Get error' } });

      await expect(worker.work(options)).toEmitValuesWith((received) => {
        expect(received).toHaveLength(1);
        const results = received[0];
        expect(results).toEqual({ alertStates: [], annotations: [] });
      });
    });
  });
});

describe('UnifiedAlertStateWorker with RBAC', () => {
  beforeAll(() => {
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
