import { AlertState, AlertStateInfo, getDefaultTimeRange, TimeRange } from '@grafana/data';
import { backendSrv } from 'app/core/services/backend_srv';

import { silenceConsoleOutput } from '../../../../../test/core/utils/silenceConsoleOutput';
import * as store from '../../../../store/store';

import { AlertStatesWorker } from './AlertStatesWorker';
import { DashboardQueryRunnerOptions } from './types';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => backendSrv,
}));

function getDefaultOptions(): DashboardQueryRunnerOptions {
  const dashboard: any = { id: 'an id', panels: [{ alert: {} }] };
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

describe('AlertStatesWorker', () => {
  const worker = new AlertStatesWorker();

  describe('when canWork is called with correct props', () => {
    it('then it should return true', () => {
      const options = getDefaultOptions();

      expect(worker.canWork(options)).toBe(true);
    });
  });

  describe('when canWork is called with no dashboard id', () => {
    it('then it should return false', () => {
      const dashboard: any = {};
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

  describe('when canWork is called for dashboard with no alert panels', () => {
    it('then it should return false', () => {
      const options = getDefaultOptions();
      options.dashboard.panels.forEach((panel) => delete panel.alert);
      expect(worker.canWork(options)).toBe(false);
    });
  });

  describe('when run is called with incorrect props', () => {
    it('then it should return the correct results', async () => {
      const { getMock, options } = getTestContext();
      const dashboard: any = {};

      await expect(worker.work({ ...options, dashboard })).toEmitValuesWith((received) => {
        expect(received).toHaveLength(1);
        const results = received[0];
        expect(results).toEqual({ alertStates: [], annotations: [] });
        expect(getMock).not.toHaveBeenCalled();
      });
    });
  });

  describe('when run is called with correct props and request is successful', () => {
    it('then it should return the correct results', async () => {
      const getResults: AlertStateInfo[] = [
        { id: 1, state: AlertState.Alerting, dashboardId: 1, panelId: 1 },
        { id: 2, state: AlertState.Alerting, dashboardId: 1, panelId: 2 },
      ];
      const { getMock, options } = getTestContext();
      getMock.mockResolvedValue(getResults);

      await expect(worker.work(options)).toEmitValuesWith((received) => {
        expect(received).toHaveLength(1);
        const results = received[0];
        expect(results).toEqual({ alertStates: getResults, annotations: [] });
        expect(getMock).toHaveBeenCalledTimes(1);
      });
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
