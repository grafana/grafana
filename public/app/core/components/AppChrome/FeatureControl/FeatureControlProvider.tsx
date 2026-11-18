import { ClientProviderEvents } from '@openfeature/web-sdk';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { locationService } from '@grafana/runtime';
import { getLocalStorageProvider } from '@grafana/runtime/internal';
import { useStoredBoolean, useStoredString } from 'app/core/hooks/useStored';
import { getPreviewAssetsFolder } from 'app/core/utils/previewAssets';

import type { FeatureControlFlagProps } from './FeatureControlFlag';

const compare = new Intl.Collator('en', { sensitivity: 'base', numeric: true }).compare;

type Flag = NonNullable<FeatureControlFlagProps['flag']>;

const recordToOverrides = (flags: Record<string, string>): Flag[] =>
  Object.entries(flags)
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => compare(a.key, b.key));

const FEATURE_CONTROL_ACCESSIBLE_LOCAL_STORAGE_KEY = 'grafana.feature-control.accessible';
const FEATURE_CONTROL_OPEN_LOCAL_STORAGE_KEY = 'grafana.feature-control.open';
const FEATURE_CONTROL_SUSPENDED_LOCAL_STORAGE_KEY = 'grafana.feature-control.suspended';

export type FeatureControlContextType = {
  /** Whether the feature control button is in the toolbar */
  isAccessible: boolean;
  setIsAccessible: (isAccessible: boolean) => void;
  /** Whether the feature control panel itself is open */
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  /** The current feature flag overrides */
  overrides: Flag[];
  /** Whether overrides are temporarily reset to their default values */
  isSuspended: boolean;
  /** Snapshot the current overrides and clear them so flags evaluate to defaults */
  resetToDefaults: () => void;
  /** Re-apply the overrides snapshot taken by `resetToDefaults` */
  restoreOverrides: () => void;
};

export const FeatureControlContext = createContext<FeatureControlContextType>({
  isAccessible: false,
  setIsAccessible: () => {},
  isOpen: false,
  setIsOpen: () => {},
  overrides: [],
  isSuspended: false,
  resetToDefaults: () => {},
  restoreOverrides: () => {},
});

export const useFeatureControlContext = () => useContext(FeatureControlContext);

export const FeatureControlContextProvider = ({ children }: { children: ReactNode }) => {
  const [overrides, setOverrides] = useState<Flag[]>([]);
  const previewAssetsActive = Boolean(getPreviewAssetsFolder());
  const [storedIsAccessible, setStoredIsAccessible] = useStoredBoolean(
    FEATURE_CONTROL_ACCESSIBLE_LOCAL_STORAGE_KEY,
    previewAssetsActive
  );
  const [storedIsOpen, setStoredIsOpen] = useStoredBoolean(FEATURE_CONTROL_OPEN_LOCAL_STORAGE_KEY, previewAssetsActive);

  // Ignore persisted dismissals on the first render of a preview session, but
  // clear the override when the user changes either value during that session.
  const [forceAccessible, setForceAccessible] = useState(previewAssetsActive);
  const [forceOpen, setForceOpen] = useState(previewAssetsActive);
  const isAccessible = forceAccessible || storedIsAccessible;
  const isOpen = forceOpen || storedIsOpen;
  const setIsAccessible = useCallback(
    (value: boolean) => {
      setForceAccessible(false);
      setStoredIsAccessible(value);
    },
    [setStoredIsAccessible]
  );
  const setIsOpen = useCallback(
    (value: boolean) => {
      setForceOpen(false);
      setStoredIsOpen(value);
    },
    [setStoredIsOpen]
  );

  useEffect(() => {
    const syncForcedState = () => {
      if (locationService.getSearchObject().featureControl === true) {
        setIsAccessible(true);
        setIsOpen(true);
      }
    };
    syncForcedState();

    const subscription = locationService.getLocationObservable().subscribe(syncForcedState);
    return () => subscription.unsubscribe();
  }, [setIsAccessible, setIsOpen]);

  const [suspendedBackup, setSuspendedBackup] = useStoredString(FEATURE_CONTROL_SUSPENDED_LOCAL_STORAGE_KEY, '');
  const isSuspended = suspendedBackup !== '';

  const resetToDefaults = useCallback(() => {
    const current = getLocalStorageProvider().getFlags();
    if (Object.keys(current).length === 0) {
      return;
    }
    setSuspendedBackup(JSON.stringify(current));
    getLocalStorageProvider().clearFlags();
  }, [setSuspendedBackup]);

  const restoreOverrides = useCallback(() => {
    if (suspendedBackup) {
      try {
        getLocalStorageProvider().setFlags(JSON.parse(suspendedBackup));
      } catch {}
    }
    setSuspendedBackup('');
  }, [suspendedBackup, setSuspendedBackup]);

  // While suspended, the active flags are cleared, so surface the snapshot instead
  // so the panel can still show the overrides (greyed out).
  const displayedOverrides = useMemo(() => {
    if (!isSuspended) {
      return overrides;
    }
    try {
      return recordToOverrides(JSON.parse(suspendedBackup));
    } catch {
      return overrides;
    }
  }, [isSuspended, suspendedBackup, overrides]);

  useEffect(() => {
    const loadFlags = () => {
      setOverrides(recordToOverrides(getLocalStorageProvider().getFlags()));
    };
    loadFlags();

    getLocalStorageProvider().events.addHandler(ClientProviderEvents.ConfigurationChanged, loadFlags);
    return () => {
      getLocalStorageProvider().events.removeHandler(ClientProviderEvents.ConfigurationChanged, loadFlags);
    };
  }, []);

  const value = useMemo(
    () => ({
      isAccessible,
      setIsAccessible,
      isOpen,
      setIsOpen,
      overrides: displayedOverrides,
      isSuspended,
      resetToDefaults,
      restoreOverrides,
    }),
    [
      isAccessible,
      setIsAccessible,
      isOpen,
      setIsOpen,
      displayedOverrides,
      isSuspended,
      resetToDefaults,
      restoreOverrides,
    ]
  );

  return <FeatureControlContext.Provider value={value}>{children}</FeatureControlContext.Provider>;
};
