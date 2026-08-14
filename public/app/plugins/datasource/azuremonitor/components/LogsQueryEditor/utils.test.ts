import { calculateTimeRange, shouldShowBasicLogsToggle } from './utils';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => ({
    replace: (val: string) => {
      if (val === '$ws') {
        return '/subscriptions/def-456/resourceGroups/dev-3/providers/microsoft.operationalinsights/workspaces/la-workspace';
      }
      return val;
    },
  }),
}));

describe('LogsQueryEditor utils', () => {
  describe('shouldShowBasicLogsToggle', () => {
    it('should return false if basic logs are not enabled', () => {
      expect(
        shouldShowBasicLogsToggle(
          [
            '/subscriptions/def-456/resourceGroups/dev-3/providers/microsoft.operationalinsights/workspaces/la-workspace',
          ],
          false
        )
      ).toBe(false);
    });

    it('should return false if selected resource is not an LA workspace', () => {
      expect(
        shouldShowBasicLogsToggle(
          [
            '/subscriptions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/resourceGroups/cloud-datasources/providers/Microsoft.Storage/storageAccounts/csb100320016c43d2d0/fileServices/default',
          ],
          true
        )
      ).toBe(false);
    });

    it('should return false if no resources are selected', () => {
      expect(shouldShowBasicLogsToggle([], true)).toBe(false);
    });

    it('should return false if more than one resource is selected', () => {
      expect(
        shouldShowBasicLogsToggle(
          [
            '/subscriptions/def-456/resourceGroups/dev-3/providers/microsoft.operationalinsights/workspaces/la-workspace',
            '/subscriptions/def-456/resourceGroups/dev-3/providers/microsoft.OperationalInsights/workspaces/la-workspace2',
          ],
          true
        )
      ).toBe(false);
    });

    it('should return true if basic logs are enabled and selected single resource is an LA workspace', () => {
      expect(
        shouldShowBasicLogsToggle(
          [
            '/subscriptions/def-456/resourceGroups/dev-3/providers/microsoft.operationalinsights/workspaces/la-workspace',
          ],
          true
        )
      ).toBe(true);
    });

    it('should return true if basic logs are enabled and selected single resource is an LA workspace variable', () => {
      expect(shouldShowBasicLogsToggle(['$ws'], true)).toBe(true);
    });
  });

  describe('calculateTimeRange', () => {
    it('should correctly calculate the time range in days', () => {
      const from = Date.now() - 1000 * 60 * 60 * 24 * 3; // 3 days ago
      const to = Date.now();

      const result = calculateTimeRange(from, to);

      // The result should be approximately 3
      expect(result).toBeCloseTo(3, 0);
    });

    it('should return 0 when from and to are the same', () => {
      const from = Date.now();
      const to = from;

      const result = calculateTimeRange(from, to);

      expect(result).toBe(0);
    });

    it('should return a negative number when from is later than to', () => {
      const from = Date.now();
      const to = from - 1000 * 60 * 60 * 24; // 1 day ago

      const result = calculateTimeRange(from, to);

      // The result should be approximately -1
      expect(result).toBeCloseTo(-1, 0);
    });
  });
});
