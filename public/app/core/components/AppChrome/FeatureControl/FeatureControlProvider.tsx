import { createContext, type ReactNode, useContext, useEffect, useMemo } from 'react';

import { locationService } from '@grafana/runtime';
import { useStoredBoolean } from 'app/core/hooks/useStoredBoolean';

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
  const [isAccessible, setIsAccessible] = useStoredBoolean(FEATURE_CONTROL_ACCESSIBLE_LOCAL_STORAGE_KEY, false);
  const [isOpen, setIsOpen] = useStoredBoolean(FEATURE_CONTROL_OPEN_LOCAL_STORAGE_KEY, false);

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
