import { ClientProviderEvents } from '@openfeature/web-sdk';
import { useEffect, useState } from 'react';

import { getLocalStorageProvider } from '@grafana/runtime/internal';

import type { FeatureControlFlagProps } from './FeatureControlFlag';

export type FeatureFlagOverride = NonNullable<FeatureControlFlagProps['flag']>;

const compare = new Intl.Collator('en', { sensitivity: 'base', numeric: true }).compare;

/** The feature flag overrides currently set in local storage, sorted by key. */
export const useFeatureFlagOverrides = (): FeatureFlagOverride[] => {
  const [flags, setFlags] = useState<FeatureFlagOverride[]>([]);

  useEffect(() => {
    const loadFlags = () => {
      setFlags(
        Object.entries(getLocalStorageProvider().getFlags())
          .map(([key, value]) => ({ key, value }))
          .sort((a, b) => compare(a.key, b.key))
      );
    };
    loadFlags();

    getLocalStorageProvider().events.addHandler(ClientProviderEvents.ConfigurationChanged, loadFlags);
    return () => {
      getLocalStorageProvider().events.removeHandler(ClientProviderEvents.ConfigurationChanged, loadFlags);
    };
  }, []);

  return flags;
};
