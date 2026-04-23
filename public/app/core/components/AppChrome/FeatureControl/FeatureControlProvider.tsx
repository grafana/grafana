import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo } from 'react';
import { useLocalStorage } from 'react-use';

import { locationService } from '@grafana/runtime';

const FEATURE_CONTROL_ACCESSIBLE_LOCAL_STORAGE_KEY = 'grafana.feature-control.accessible';
const FEATURE_CONTROL_OPEN_LOCAL_STORAGE_KEY = 'grafana.feature-control.open';
const FEATURE_CONTROL_CORNER_LOCAL_STORAGE_KEY = 'grafana.feature-control.corner';

const corners = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;
export type FeatureControlCorner = (typeof corners)[number];

const isCorner = (value: string): value is FeatureControlCorner => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return corners.includes(value as FeatureControlCorner);
};

export type FeatureControlContextType = {
  isAccessible: boolean;
  setIsAccessible: (isAccessible: boolean) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  corner: FeatureControlCorner;
  setCorner: (corner: FeatureControlCorner) => void;
};

export const FeatureControlContext = createContext<FeatureControlContextType>({
  isAccessible: false,
  setIsAccessible: () => {},
  isOpen: false,
  setIsOpen: () => {},
  corner: 'bottom-right',
  setCorner: () => {},
});

export function useFeatureControlContext() {
  return useContext(FeatureControlContext);
}

interface FeatureControlContextProviderProps {
  children: ReactNode;
  initialIsAccessible?: boolean;
  initialIsOpen?: boolean;
  initialCorner?: FeatureControlCorner;
}

export const FeatureControlContextProvider = ({
  children,
  initialIsAccessible = false,
  initialIsOpen = false,
  initialCorner = 'bottom-right',
}: FeatureControlContextProviderProps) => {
  const [storedIsAccessible, setStoredIsAccessible] = useLocalStorage<boolean>(
    FEATURE_CONTROL_ACCESSIBLE_LOCAL_STORAGE_KEY,
    initialIsAccessible,
    {
      raw: false,
      serializer: (value) => value.toString(),
      deserializer: (value) => value === 'true',
    }
  );
  const [storedIsOpen, setStoredIsOpen] = useLocalStorage<boolean>(
    FEATURE_CONTROL_OPEN_LOCAL_STORAGE_KEY,
    initialIsOpen,
    {
      raw: false,
      serializer: (value) => value.toString(),
      deserializer: (value) => value === 'true',
    }
  );
  const [storedCorner, setStoredCorner] = useLocalStorage<FeatureControlCorner>(
    FEATURE_CONTROL_CORNER_LOCAL_STORAGE_KEY,
    initialCorner,
    {
      raw: false,
      serializer: (value) => value,
      deserializer: (value) => (isCorner(value) ? value : 'bottom-right'),
    }
  );
  const isAccessible = storedIsAccessible ?? false;
  const isOpen = storedIsOpen ?? false;
  const corner = storedCorner ?? 'bottom-right';

  const setIsAccessible = useCallback(
    (value: boolean) => {
      setStoredIsAccessible(value);
    },
    [setStoredIsAccessible]
  );

  const setIsOpen = useCallback(
    (value: boolean) => {
      setStoredIsOpen(value);
    },
    [setStoredIsOpen]
  );

  const setCorner = useCallback(
    (value: FeatureControlCorner) => {
      setStoredCorner(value);
    },
    [setStoredCorner]
  );

  useEffect(() => {
    const syncAccessibleState = () => {
      const queryParams = locationService.getSearchObject();
      const isForcedOn = queryParams.featureControl === true;

      if (isForcedOn) {
        setIsAccessible(true);
        setIsOpen(true);
      }
    };

    syncAccessibleState();

    const subscription = locationService.getLocationObservable().subscribe(() => {
      syncAccessibleState();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setIsAccessible, setIsOpen]);

  const value = useMemo(
    () => ({
      isAccessible,
      setIsAccessible,
      isOpen,
      setIsOpen,
      corner,
      setCorner,
    }),
    [corner, isAccessible, isOpen, setCorner, setIsAccessible, setIsOpen]
  );

  return <FeatureControlContext.Provider value={value}>{children}</FeatureControlContext.Provider>;
};
