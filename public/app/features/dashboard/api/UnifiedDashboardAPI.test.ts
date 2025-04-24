import { Dashboard } from '@grafana/schema/dist/esm/index';
import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha1/types.spec.gen';
import { DashboardDTO } from 'app/types';

import { SaveDashboardCommand } from '../components/SaveDashboard/types';

import { UnifiedDashboardAPI } from './UnifiedDashboardAPI';
import { DashboardVersionError, DashboardWithAccessInfo } from './types';
import { isV2DashboardCommand } from './utils';
import { K8sDashboardAPI } from './v1';
import { K8sDashboardV2API } from './v2';

jest.mock('./v1');
jest.mock('./v2');

describe('UnifiedDashboardAPI', () => {
  let api: UnifiedDashboardAPI;
  let v1Client: jest.Mocked<K8sDashboardAPI>;
  let v2Client: jest.Mocked<K8sDashboardV2API>;

  beforeEach(() => {
    jest.clearAllMocks();
    api = new UnifiedDashboardAPI();
    v1Client = api['v1Client'] as jest.Mocked<K8sDashboardAPI>;
    v2Client = api['v2Client'] as jest.Mocked<K8sDashboardV2API>;
  });

  describe('getDashboardDTO', () => {
    it('should try v1 first and return result if successful', async () => {
      const mockResponse = { dashboard: { title: 'test' } };
      v1Client.getDashboardDTO.mockResolvedValue(mockResponse as DashboardDTO);

      const result = await api.getDashboardDTO('123');

      expect(result).toBe(mockResponse);
      expect(v1Client.getDashboardDTO).toHaveBeenCalledWith('123');
      expect(v2Client.getDashboardDTO).not.toHaveBeenCalled();
    });

    it('should fallback to v2 if v1 throws DashboardVersionError', async () => {
      const mockV2Response = { spec: { title: 'test' } };
      v1Client.getDashboardDTO.mockRejectedValue(new DashboardVersionError('v2alpha1', 'Dashboard is V1 format'));
      v2Client.getDashboardDTO.mockResolvedValue(mockV2Response as DashboardWithAccessInfo<DashboardV2Spec>);

      const result = await api.getDashboardDTO('123');

      expect(result).toBe(mockV2Response);
      expect(v2Client.getDashboardDTO).toHaveBeenCalledWith('123');
    });
  });

  describe('saveDashboard', () => {
    it('should use v1 client for v1 dashboard', async () => {
      const mockCommand = { dashboard: { title: 'test' } };
      v1Client.saveDashboard.mockResolvedValue({ id: 1, status: 'success', slug: '', uid: '', url: '', version: 1 });

      await api.saveDashboard(mockCommand as SaveDashboardCommand<Dashboard>);

      expect(v1Client.saveDashboard).toHaveBeenCalledWith(mockCommand);
      expect(v2Client.saveDashboard).not.toHaveBeenCalled();
    });

    it('should use v2 client for v2 dashboard', async () => {
      const mockCommand: SaveDashboardCommand<DashboardV2Spec> = {
        dashboard: {
          title: 'test',
          elements: {},
          annotations: [],
          cursorSync: 'Crosshair',
          layout: {
            kind: 'GridLayout',
            spec: { items: [] },
          },
          liveNow: false,
          tags: [],
          links: [],
          preload: false,
          timeSettings: {
            from: 'now-1h',
            to: 'now',
            autoRefresh: '5s',
            autoRefreshIntervals: ['5s', '1m', '5m', '15m', '30m', '1h', '4h', '8h', '12h', '24h'],
            timezone: 'utc',
            hideTimepicker: false,
            fiscalYearStartMonth: 0,
          },
          variables: [],
        },
      };

      v2Client.saveDashboard.mockResolvedValue({ id: 1, status: 'success', slug: '', uid: '', url: '', version: 1 });

      await api.saveDashboard(mockCommand as SaveDashboardCommand<DashboardV2Spec>);

      expect(isV2DashboardCommand(mockCommand)).toBe(true);
      expect(v2Client.saveDashboard).toHaveBeenCalledWith(mockCommand);
      expect(v1Client.saveDashboard).not.toHaveBeenCalled();
    });
  });

  describe('deleteDashboard', () => {
    it('should not try other version if fails', async () => {
      v1Client.deleteDashboard.mockRejectedValue(new DashboardVersionError('v2alpha1', 'Dashboard is V1 format'));

      try {
        await api.deleteDashboard('123', true);
      } catch (error) {}
      expect(v1Client.deleteDashboard).toHaveBeenCalledWith('123', true);
      expect(v2Client.deleteDashboard).not.toHaveBeenCalled();
    });
  });
});
