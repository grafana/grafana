import { getWrapper, renderHook, waitFor } from 'test/test-utils';

import { config } from '@grafana/runtime';

import { setupMswServer } from '../mockApi';

import { useIntegrationTypeSchemas } from './integrationSchemasApi';

setupMswServer();

const wrapper = () => getWrapper({ renderWithRouter: true });

describe('useIntegrationTypeSchemas', () => {
  afterEach(() => {
    config.featureToggles.alertingSyncNotifiersApiMigration = false;
  });

  describe('with alertingSyncNotifiersApiMigration flag disabled', () => {
    beforeEach(() => {
      config.featureToggles.alertingSyncNotifiersApiMigration = false;
    });

    it('should return data from legacy API', async () => {
      const { result } = renderHook(() => useIntegrationTypeSchemas(), { wrapper: wrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.length).toBeGreaterThan(0);
      // Legacy API returns notifiers with top-level options
      expect(result.current.data?.[0].options).toBeDefined();
    });
  });

  describe('with alertingSyncNotifiersApiMigration flag enabled', () => {
    beforeEach(() => {
      config.featureToggles.alertingSyncNotifiersApiMigration = true;
    });

    it('should return data from new k8s API', async () => {
      const { result } = renderHook(() => useIntegrationTypeSchemas(), { wrapper: wrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.length).toBeGreaterThan(0);
    });

    it('should transform response to NotifierDTO format with versions', async () => {
      const { result } = renderHook(() => useIntegrationTypeSchemas(), { wrapper: wrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const notifier = result.current.data?.[0];
      expect(notifier).toBeDefined();
      expect(notifier?.type).toBeDefined();
      expect(notifier?.name).toBeDefined();
      expect(notifier?.versions).toBeDefined();
      expect(notifier?.versions?.length).toBeGreaterThan(0);
    });

    it('should populate secureFieldKey on secure options', async () => {
      const { result } = renderHook(() => useIntegrationTypeSchemas(), { wrapper: wrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Find a notifier with secure options
      const notifierWithSecure = result.current.data?.find((n) =>
        n.versions?.some((v) => v.options.some((o) => o.secure))
      );

      if (notifierWithSecure) {
        const secureOption = notifierWithSecure.versions?.flatMap((v) => v.options).find((o) => o.secure);

        expect(secureOption?.secureFieldKey).toBe(secureOption?.propertyName);
      }
    });

    it('should handle nested subformOptions with correct secureFieldKey paths', async () => {
      const { result } = renderHook(() => useIntegrationTypeSchemas(), { wrapper: wrapper() });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Find a notifier with subformOptions
      const notifierWithSubform = result.current.data?.find((n) =>
        n.versions?.some((v) => v.options.some((o) => o.subformOptions?.length))
      );

      if (notifierWithSubform) {
        const optionWithSubform = notifierWithSubform.versions
          ?.flatMap((v) => v.options)
          .find((o) => o.subformOptions?.length);

        const secureSubOption = optionWithSubform?.subformOptions?.find((o) => o.secure);
        if (secureSubOption) {
          // secureFieldKey should include parent path
          expect(secureSubOption.secureFieldKey).toContain(optionWithSubform?.propertyName);
        }
      }
    });
  });

  describe('skip option', () => {
    it('should not fetch when skip is true', async () => {
      const { result } = renderHook(() => useIntegrationTypeSchemas({ skip: true }), {
        wrapper: wrapper(),
      });

      // Should remain in initial state
      expect(result.current.data).toBeUndefined();
    });
  });
});
