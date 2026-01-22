import { renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { getWrapper } from 'test/test-utils';

import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { grantUserPermissions } from 'app/features/alerting/unified/mocks';
import {
  TIME_INTERVAL_NAME_FILE_PROVISIONED,
  TIME_INTERVAL_NAME_HAPPY_PATH,
} from 'app/features/alerting/unified/mocks/server/handlers/k8s/timeIntervals.k8s';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { AccessControlAction } from 'app/types/accessControl';

import { useGetMuteTiming, useMuteTimings } from './useMuteTimings';

const wrapper = ({ children }: { children: ReactNode }) => {
  const ProviderWrapper = getWrapper({ renderWithRouter: true });
  return <ProviderWrapper>{children}</ProviderWrapper>;
};

setupMswServer();

describe('useMuteTimings', () => {
  beforeEach(() => {
    grantUserPermissions([AccessControlAction.AlertingNotificationsRead]);
  });

  describe('useMuteTimings', () => {
    it('should return mute timings with correct data structure', async () => {
      const { result } = renderHook(
        () =>
          useMuteTimings({
            alertmanager: GRAFANA_RULES_SOURCE_NAME,
            skip: false,
          }),
        {
          wrapper,
        }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeDefined();
      expect(Array.isArray(result.current.data)).toBe(true);

      const timings = result.current.data!;
      expect(timings.length).toBeGreaterThan(0);

      // Verify structure of first timing
      const firstTiming = timings[0];
      expect(firstTiming).toHaveProperty('id');
      expect(firstTiming).toHaveProperty('name');
      expect(firstTiming).toHaveProperty('time_intervals');
      expect(typeof firstTiming.id).toBe('string');
      expect(typeof firstTiming.name).toBe('string');
      expect(Array.isArray(firstTiming.time_intervals)).toBe(true);
    });

    it('should correctly identify provisioned intervals', async () => {
      const { result } = renderHook(
        () =>
          useMuteTimings({
            alertmanager: GRAFANA_RULES_SOURCE_NAME,
            skip: false,
          }),
        {
          wrapper,
        }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const timings = result.current.data!;

      // Find the provisioned interval
      const provisionedTiming = timings.find((t) => t.name === TIME_INTERVAL_NAME_FILE_PROVISIONED);
      expect(provisionedTiming).toBeDefined();
      expect(provisionedTiming?.provisioned).toBe(true);

      // Find the non-provisioned interval
      const nonProvisionedTiming = timings.find((t) => t.name === TIME_INTERVAL_NAME_HAPPY_PATH);
      expect(nonProvisionedTiming).toBeDefined();
      expect(nonProvisionedTiming?.provisioned).toBe(false);
    });
  });

  describe('useGetMuteTiming', () => {
    it('should return single mute timing by name for editing', async () => {
      const { result } = renderHook(
        () =>
          useGetMuteTiming({
            alertmanager: GRAFANA_RULES_SOURCE_NAME,
            name: TIME_INTERVAL_NAME_HAPPY_PATH,
          }),
        {
          wrapper,
        }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.name).toBe(TIME_INTERVAL_NAME_HAPPY_PATH);
      expect(result.current.data?.id).toBe(TIME_INTERVAL_NAME_HAPPY_PATH);
      expect(result.current.data).toHaveProperty('time_intervals');
      expect(result.current.isError).toBe(false);
    });
  });
});
