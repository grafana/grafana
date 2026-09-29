import { InMemoryProvider, OpenFeature } from '@openfeature/web-sdk';
import { act, renderHook, waitFor } from '@testing-library/react';

import { BATCH_API_FLAG, isBatchAPIFlagEnabled, OPEN_FEATURE_DOMAIN, useBatchAPIFlag } from './featureFlags';

const batchFlagConfig = (enabled: boolean) => ({
  [BATCH_API_FLAG]: {
    variants: { on: true, off: false },
    defaultVariant: enabled ? 'on' : 'off',
    disabled: false,
  },
});

describe('featureFlags', () => {
  afterEach(async () => {
    await OpenFeature.clearProviders();
  });

  describe('isBatchAPIFlagEnabled', () => {
    it('falls back to the default value when no provider is registered', () => {
      expect(isBatchAPIFlagEnabled()).toBe(false);
    });

    it('returns the evaluated flag value once the provider is ready', async () => {
      await OpenFeature.setProviderAndWait(OPEN_FEATURE_DOMAIN, new InMemoryProvider(batchFlagConfig(true)));
      expect(isBatchAPIFlagEnabled()).toBe(true);

      await OpenFeature.setProviderAndWait(OPEN_FEATURE_DOMAIN, new InMemoryProvider(batchFlagConfig(false)));
      expect(isBatchAPIFlagEnabled()).toBe(false);
    });
  });

  describe('useBatchAPIFlag', () => {
    it('re-renders with the flag value when the provider becomes ready', async () => {
      const { result } = renderHook(() => useBatchAPIFlag());
      expect(result.current).toBe(false);

      // act() contains the state updates the hook's provider-event handlers
      // schedule while the provider initializes.
      await act(async () => {
        await OpenFeature.setProviderAndWait(OPEN_FEATURE_DOMAIN, new InMemoryProvider(batchFlagConfig(true)));
      });

      await waitFor(() => expect(result.current).toBe(true));
    });

    it('re-renders when the flag configuration changes on a ready provider', async () => {
      const provider = new InMemoryProvider(batchFlagConfig(false));
      await OpenFeature.setProviderAndWait(OPEN_FEATURE_DOMAIN, provider);

      const { result } = renderHook(() => useBatchAPIFlag());
      expect(result.current).toBe(false);

      await act(async () => {
        await provider.putConfiguration(batchFlagConfig(true));
      });

      await waitFor(() => expect(result.current).toBe(true));
    });

    it('falls back to the default value when the flag is missing from a ready provider', async () => {
      await OpenFeature.setProviderAndWait(OPEN_FEATURE_DOMAIN, new InMemoryProvider({}));
      expect(isBatchAPIFlagEnabled()).toBe(false);
    });
  });
});
