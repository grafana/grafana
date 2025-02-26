import { DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0/types.gen';
import { DashboardDTO } from 'app/types';

import { SaveDashboardCommand } from '../components/SaveDashboard/types';

import { UnifiedDashboardAPI } from './UnifiedDashboardAPI';
import { DashboardVersionError, DashboardWithAccessInfo } from './types';
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
      v1Client.getDashboardDTO.mockRejectedValue(new DashboardVersionError(true));
      v2Client.getDashboardDTO.mockResolvedValue(mockV2Response as DashboardWithAccessInfo<DashboardV2Spec>);

      const result = await api.getDashboardDTO('123');

      expect(result).toBe(mockV2Response);
      expect(v2Client.getDashboardDTO).toHaveBeenCalledWith('123', undefined);
    });
  });

  describe('saveDashboard', () => {
    it('should use v2 client for v2 dashboard', async () => {
      const mockCommand = { dashboard: { spec: { title: 'test' } } };
      v2Client.saveDashboard.mockResolvedValue({ id: 1, status: 'success', slug: '', uid: '', url: '', version: 1 });

      await api.saveDashboard(mockCommand as unknown as SaveDashboardCommand<DashboardV2Spec>);

      expect(v2Client.saveDashboard).toHaveBeenCalledWith(mockCommand);
      expect(v1Client.saveDashboard).not.toHaveBeenCalled();
    });
  });

  describe('deleteDashboard', () => {
    it('should try v1 first and fallback to v2 on version error', async () => {
      v1Client.deleteDashboard.mockRejectedValue(new DashboardVersionError(true));
      v2Client.deleteDashboard.mockResolvedValue({ id: 1, message: 'Deleted', title: 'test' });

      await api.deleteDashboard('123', true);

      expect(v1Client.deleteDashboard).toHaveBeenCalledWith('123', true);
      expect(v2Client.deleteDashboard).toHaveBeenCalledWith('123', true);
    });
  });
});
