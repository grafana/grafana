import React, { useContext, useMemo, useState } from 'react';
import { DashNav, OwnProps as DashNavProps } from '../components/DashNav';
import { selectors } from '@grafana/e2e-selectors';

export enum GorillaMode {
  hidden = 'hidden',
  readOnly = 'readOnly',
  editable = 'editable',
}

export interface GorillaContextItem {
  mode: GorillaMode;
}

export interface GorillaDashNavItem extends GorillaContextItem {
  timePicker: GorillaContextItem;
}

export interface GorillaContextType {
  onChangeConfig: GorillaChangeConfigCallback;
  config: GorillaContextConfiguration;
}

export type GorillaChangeConfigCallback = (config: GorillaContextConfiguration) => void;

export interface GorillaContextConfiguration {
  dashNav: GorillaDashNavItem;
}

export const defaultValues: GorillaContextConfiguration = {
  dashNav: {
    mode: GorillaMode.editable,
    timePicker: {
      mode: GorillaMode.editable,
    },
  },
};

export const GorillaContext = React.createContext<GorillaContextType>({
  config: defaultValues,
  onChangeConfig: () => {},
});

export function GorillaProvider({ children }: React.PropsWithChildren<any>): JSX.Element {
  const [config, setConfig] = useState(defaultValues);
  const value = useMemo(() => ({ config, onChangeConfig: setConfig }), [config]);

  return <GorillaContext.Provider value={value}>{children}</GorillaContext.Provider>;
}

export function GorillaDashNav(props: DashNavProps): JSX.Element | null {
  const {
    config: { dashNav },
  } = useContext(GorillaContext);

  switch (dashNav.mode) {
    case GorillaMode.editable: {
      return (
        <div aria-label={selectors.pages.Dashboard.DashNav.nav}>
          <DashNav {...props} />
        </div>
      );
    }

    default:
      return null;
  }
}

interface GorillaConfigChangerProps {
  children: (onChangeConfig: GorillaChangeConfigCallback) => JSX.Element;
}

export function GorillaConfigChanger({ children }: GorillaConfigChangerProps): JSX.Element {
  const onChangeConfig = useGorillaConfigChanger();
  return children(onChangeConfig);
}

export function useGorillaConfigChanger(): GorillaChangeConfigCallback {
  const { onChangeConfig } = useContext(GorillaContext);
  return onChangeConfig;
}
