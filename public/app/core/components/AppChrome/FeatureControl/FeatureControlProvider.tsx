import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { locationService } from '@grafana/runtime';
import { useStoredBoolean } from 'app/core/hooks/useStored';
import { getPreviewAssetsFolder } from 'app/core/utils/previewAssets';

const FEATURE_CONTROL_ACCESSIBLE_LOCAL_STORAGE_KEY = 'grafana.feature-control.accessible';
const FEATURE_CONTROL_OPEN_LOCAL_STORAGE_KEY = 'grafana.feature-control.open';

export type FeatureControlContextType = {
  /** Whether the feature control button is in the toolbar */
  isAccessible: boolean;
  setIsAccessible: (isAccessible: boolean) => void;
  /** Whether the feature control panel itself is open */
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
};

export const FeatureControlContext = createContext<FeatureControlContextType>({
  isAccessible: false,
  setIsAccessible: () => {},
  isOpen: false,
  setIsOpen: () => {},
});

export const useFeatureControlContext = () => useContext(FeatureControlContext);

export const FeatureControlContextProvider = ({ children }: { children: ReactNode }) => {
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

  const value = useMemo(
    () => ({
      isAccessible,
      setIsAccessible,
      isOpen,
      setIsOpen,
    }),
    [isAccessible, setIsAccessible, isOpen, setIsOpen]
  );

  return <FeatureControlContext.Provider value={value}>{children}</FeatureControlContext.Provider>;
};
