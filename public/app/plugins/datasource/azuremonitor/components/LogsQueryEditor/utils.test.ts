import { shouldShowBasicLogsToggle } from './utils';

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
  });
});
