import { renderHook } from 'test/test-utils';

import { GrafanaPromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { prometheusApi } from '../../../api/prometheusApi';
import { setupMswServer } from '../../../mockApi';

import { useNamespaceAndGroupOptions } from './useRuleFilterAutocomplete';

setupMswServer();

jest.mock('../../../api/prometheusApi', () => ({
  prometheusApi: {
    useLazyGetGrafanaGroupsQuery: jest.fn(),
    useLazyGetGroupsQuery: jest.fn(),
  },
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    getList: jest.fn().mockReturnValue([]),
  }),
}));

describe('useNamespaceAndGroupOptions', () => {
  let mockFetchGrafanaGroups: jest.Mock;
  let mockFetchExternalGroups: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockFetchGrafanaGroups = jest.fn();
    mockFetchExternalGroups = jest.fn();

    (prometheusApi.useLazyGetGrafanaGroupsQuery as jest.Mock).mockReturnValue([mockFetchGrafanaGroups]);
    (prometheusApi.useLazyGetGroupsQuery as jest.Mock).mockReturnValue([mockFetchExternalGroups]);
  });

  describe('groupOptions', () => {
    it('should require minimum 3 characters before searching', async () => {
      const { result } = renderHook(() => useNamespaceAndGroupOptions());

      const options = await result.current.groupOptions('ab');

      expect(options).toHaveLength(1);
      expect(options[0]).toEqual({
        label: 'Type at least 3 characters to search groups',
        value: '__GRAFANA_INFO_OPTION__',
        infoOption: true,
      });
      expect(mockFetchGrafanaGroups).not.toHaveBeenCalled();
    });

    it('should call API with searchGroupName when 3+ characters entered', async () => {
      const mockGroups: GrafanaPromRuleGroupDTO[] = [
        { name: 'cpu-alerts', file: 'folder1', folderUid: 'uid1', interval: 60, rules: [] },
        { name: 'cpu-usage', file: 'folder2', folderUid: 'uid2', interval: 60, rules: [] },
      ];

      mockFetchGrafanaGroups.mockReturnValue({
        unwrap: () =>
          Promise.resolve({
            data: { groups: mockGroups },
          }),
      });

      const { result } = renderHook(() => useNamespaceAndGroupOptions());

      const options = await result.current.groupOptions('cpu');

      expect(mockFetchGrafanaGroups).toHaveBeenCalledWith({
        limitAlerts: 0,
        searchGroupName: 'cpu',
        groupLimit: 100,
      });

      expect(options).toHaveLength(2);
      expect(options[0]).toEqual({ label: 'cpu-alerts', value: 'cpu-alerts' });
      expect(options[1]).toEqual({ label: 'cpu-usage', value: 'cpu-usage' });
    });

    it('should show message when no groups match search', async () => {
      mockFetchGrafanaGroups.mockReturnValue({
        unwrap: () =>
          Promise.resolve({
            data: { groups: [] },
          }),
      });

      const { result } = renderHook(() => useNamespaceAndGroupOptions());

      const options = await result.current.groupOptions('xyz123');

      expect(options).toHaveLength(1);
      expect(options[0]).toEqual({
        label: 'No groups found matching "xyz123"',
        value: '__GRAFANA_INFO_OPTION__',
        infoOption: true,
      });
    });

    it('should handle API errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      mockFetchGrafanaGroups.mockReturnValue({
        unwrap: () => Promise.reject(new Error('API Error')),
      });

      const { result } = renderHook(() => useNamespaceAndGroupOptions());

      const options = await result.current.groupOptions('cpu');

      expect(options).toHaveLength(1);
      expect(options[0]).toEqual({
        label: 'Error searching groups',
        value: '__GRAFANA_INFO_OPTION__',
        infoOption: true,
      });

      consoleErrorSpy.mockRestore();
    });
  });
});
