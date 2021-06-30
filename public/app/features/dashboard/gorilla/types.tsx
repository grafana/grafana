import React, { ReactElement, useContext, useMemo, useState } from 'react';
import { get } from 'lodash';
import { DashNav, OwnProps as DashNavProps } from '../components/DashNav';
import { selectors } from '@grafana/e2e-selectors';
import { getConfig } from '../../../core/config';
import { PageToolbar, PageToolbarProps, ToolbarButton, ToolbarButtonProps } from '@grafana/ui';
import { DashNavTimeControls, Props as DashNavTimeControlsProps } from '../components/DashNav/DashNavTimeControls';

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
  title: GorillaContextItem;
  tvToggle: GorillaContextItem;
  addPanelButton: GorillaContextItem;
  DashboardSettingsButton: GorillaContextItem;
  saveDasboardButton: GorillaContextItem;
  snapshotButton: GorillaContextItem;
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
    title: {
      mode: GorillaMode.editable,
    },
    tvToggle: {
      mode: GorillaMode.editable,
    },
    addPanelButton: {
      mode: GorillaMode.editable,
    },
    DashboardSettingsButton: {
      mode: GorillaMode.editable,
    },
    saveDasboardButton: {
      mode: GorillaMode.editable,
    },
    snapshotButton: {
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

  if (!getConfig().featureToggles.customKiosk) {
    return (
      <div aria-label={selectors.pages.Dashboard.DashNav.nav}>
        <DashNav {...props} />
      </div>
    );
  }

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

export function GorillaPageToolbar(props: PageToolbarProps): ReactElement {
  const {
    dashNav: { title },
  } = useGorillaConfig();

  if (!getConfig().featureToggles.customKiosk) {
    return <PageToolbar {...props} />;
  }

  switch (title.mode) {
    case GorillaMode.hidden: {
      return (
        <PageToolbar
          {...props}
          title={''}
          titleHref={undefined}
          onGoBack={undefined}
          parent={undefined}
          parentHref={undefined}
          pageIcon={undefined}
        />
      );
    }

    default: {
      return <PageToolbar {...props} />;
    }
  }
}

export function GorillaDashNavTimeControls(props: DashNavTimeControlsProps): ReactElement | null {
  const {
    dashNav: { timePicker },
  } = useGorillaConfig();

  if (!getConfig().featureToggles.customKiosk) {
    return <DashNavTimeControls {...props} />;
  }

  switch (timePicker.mode) {
    case GorillaMode.hidden: {
      return null;
    }

    default: {
      return <DashNavTimeControls {...props} />;
    }
  }
}

export function GorillaToolbarButton(props: ToolbarButtonProps & { configPath: string }): ReactElement | null {
  const config = useGorillaConfig();
  const { configPath } = props;
  const value = get(config, configPath) as GorillaContextItem | undefined;

  if (!getConfig().featureToggles.customKiosk) {
    return <ToolbarButton {...props} />;
  }

  switch (value?.mode) {
    case GorillaMode.hidden:
      return null;

    default:
      return <ToolbarButton {...props} />;
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

export function useGorillaConfig(): GorillaContextConfiguration {
  const { config } = useContext(GorillaContext);
  return config;
}
