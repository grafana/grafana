import React, { ReactElement, useContext, useMemo, useState, useCallback } from 'react';
import { get, set } from 'lodash';
import { getConfig } from '../../../core/config';
import {
  CollapsableSection,
  Field,
  PageToolbar,
  PageToolbarProps,
  RadioButtonGroup,
  ToolbarButton,
  ToolbarButtonProps,
  Checkbox,
  useStyles2,
} from '@grafana/ui';
import { DashNavTimeControls, Props as DashNavTimeControlsProps } from '../components/DashNav/DashNavTimeControls';
import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { css } from '@emotion/css';
import { DashNavButton, DashNavButtonProps } from '../components/DashNav/DashNavButton';
import { SideMenu } from 'app/core/components/sidemenu/SideMenu';

export enum GorillaProfile {
  standard = 'standard',
  tv = 'tv',
  custom = 'custom',
}

let currentProfile = GorillaProfile.standard;

export enum GorillaMode {
  hidden = 'hidden',
  readOnly = 'readOnly',
  default = 'default',
}

const standardProfile = {
  dashNav: {
    timePicker: {
      mode: GorillaMode.default,
    },
    title: {
      mode: GorillaMode.default,
    },
    tvToggle: {
      mode: GorillaMode.default,
    },
    addPanelToggle: {
      mode: GorillaMode.hidden,
    },
    dashboardSettingsToggle: {
      mode: GorillaMode.hidden,
    },
    saveDashboardToggle: {
      mode: GorillaMode.hidden,
    },
    snapshotToggle: {
      mode: GorillaMode.hidden,
    },
    starToggle: {
      mode: GorillaMode.hidden,
    },
    sharePanelToggle: {
      mode: GorillaMode.hidden,
    },
  },
  sideMenu: {
    mode: GorillaMode.hidden,
  },
};

const tvProfile = {
  dashNav: {
    timePicker: {
      mode: GorillaMode.hidden,
    },
    title: {
      mode: GorillaMode.hidden,
    },
    tvToggle: {
      mode: GorillaMode.hidden,
    },
    addPanelToggle: {
      mode: GorillaMode.hidden,
    },
    dashboardSettingsToggle: {
      mode: GorillaMode.hidden,
    },
    saveDashboardToggle: {
      mode: GorillaMode.hidden,
    },
    snapshotToggle: {
      mode: GorillaMode.hidden,
    },
    starToggle: {
      mode: GorillaMode.hidden,
    },
    sharePanelToggle: {
      mode: GorillaMode.hidden,
    },
  },
  sideMenu: {
    mode: GorillaMode.hidden,
  },
};

const customProfile = {
  dashNav: {
    timePicker: {
      mode: GorillaMode.default,
    },
    title: {
      mode: GorillaMode.default,
    },
    tvToggle: {
      mode: GorillaMode.default,
    },
    addPanelToggle: {
      mode: GorillaMode.default,
    },
    dashboardSettingsToggle: {
      mode: GorillaMode.default,
    },
    saveDashboardToggle: {
      mode: GorillaMode.default,
    },
    snapshotToggle: {
      mode: GorillaMode.default,
    },
    starToggle: {
      mode: GorillaMode.default,
    },
    sharePanelToggle: {
      mode: GorillaMode.default,
    },
  },
  sideMenu: {
    mode: GorillaMode.default,
  },
};

const profileRegistry: Record<GorillaProfile, GorillaContextConfiguration> = {
  [GorillaProfile.standard]: standardProfile,
  [GorillaProfile.tv]: tvProfile,
  [GorillaProfile.custom]: customProfile,
};

export interface GorillaContextItem {
  mode: GorillaMode;
}
export interface GorillaContextType {
  enabled: boolean;
  onChangeConfig: GorillaChangeConfigCallback;
  config: GorillaContextConfiguration;
  onToggleEnabled: () => void;
}

export type GorillaChangeConfigCallback = (config: GorillaContextConfiguration) => void;

export interface GorillaContextConfiguration {
  dashNav: {
    timePicker: GorillaContextItem;
    title: GorillaContextItem;
    tvToggle: GorillaContextItem;
    addPanelToggle: GorillaContextItem;
    dashboardSettingsToggle: GorillaContextItem;
    saveDashboardToggle: GorillaContextItem;
    snapshotToggle: GorillaContextItem;
    starToggle: GorillaContextItem;
    sharePanelToggle: GorillaContextItem;
  };
  sideMenu: GorillaContextItem;
}

export const GorillaContext = React.createContext<GorillaContextType>({
  config: standardProfile,
  onChangeConfig: () => {},
  enabled: false,
  onToggleEnabled: () => {},
});

export function GorillaProvider({ children }: React.PropsWithChildren<any>): JSX.Element {
  const [config, setConfig] = useState(standardProfile);
  const [enabled, setEnabled] = useState(false);

  const value = useMemo(
    () => ({
      config,
      onChangeConfig: setConfig,
      enabled,
      onToggleEnabled: () => setEnabled(!enabled),
    }),
    [config, enabled]
  );

  return <GorillaContext.Provider value={value}>{children}</GorillaContext.Provider>;
}

export function GorillaPageToolbar(props: PageToolbarProps): ReactElement {
  const { dashNav } = useGorillaConfig();
  const { title } = dashNav;

  if (!getConfig().featureToggles.customKiosk) {
    return <PageToolbar {...props} />;
  }

  const hideToolbar = !Object.values(dashNav).find((value) => value.mode !== GorillaMode.hidden);

  if (hideToolbar) {
    return <div style={{ marginTop: '16px' }} />;
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

export function GorillaDashNavButton(props: DashNavButtonProps & { configPath: string }): ReactElement | null {
  const config = useGorillaConfig();
  const { configPath } = props;
  const value = get(config, configPath) as GorillaContextItem | undefined;

  if (!getConfig().featureToggles.customKiosk) {
    return <DashNavButton {...props} />;
  }

  switch (value?.mode) {
    case GorillaMode.hidden:
      return null;

    default:
      return <DashNavButton {...props} />;
  }
}

export function GorillaSideMenu(): ReactElement | null {
  const { sideMenu } = useGorillaConfig();

  if (!getConfig().featureToggles.customKiosk) {
    return <SideMenu />;
  }

  switch (sideMenu.mode) {
    case GorillaMode.hidden: {
      return null;
    }

    default: {
      return <SideMenu />;
    }
  }
}

type GorillaSettingsProps = {};

export function GorillaSettings(props: GorillaSettingsProps): ReactElement | null {
  const { config, onChangeConfig } = useContext(GorillaContext);
  const styles = useStyles2(getStyles);

  const onChangeProfile = useCallback(
    (profile: GorillaProfile) => {
      const configuration = profileRegistry[profile];

      if (!configuration) {
        return;
      }
      currentProfile = profile;
      onChangeConfig(configuration);
    },
    [onChangeConfig]
  );

  const onChangeOption = useCallback(
    (path: string) => {
      const current = get(customProfile, path) as GorillaContextItem;

      if (current?.mode === GorillaMode.default) {
        set(customProfile, path, { mode: GorillaMode.hidden });
        onChangeConfig({ ...customProfile });
        return;
      }

      set(customProfile, path, { mode: GorillaMode.default });
      onChangeConfig({ ...customProfile });
    },
    [onChangeConfig]
  );

  if (!getConfig().featureToggles.customKiosk) {
    return null;
  }

  const configurableOptions: Array<SelectableValue<string>> = [
    { value: 'sideMenu', label: 'Side Menu' },
    { value: 'dashNav.timePicker', label: 'Time picker' },
    { value: 'dashNav.title', label: 'Title' },
    { value: 'dashNav.tvToggle', label: 'Kiosk mode button' },
    { value: 'dashNav.addPanelToggle', label: 'Add panel button' },
    { value: 'dashNav.snapshotToggle', label: 'Snapshot Button' },
    { value: 'dashNav.starToggle', label: 'Star button' },
    { value: 'dashNav.sharePanelToggle', label: 'Share Dashboard or Panel Button' },
  ];

  return (
    <CollapsableSection label="Kiosk options" isOpen={true}>
      <Field label="Kiosk type" description="Controls what UI components will be displayed in dashboard kiosk mode.">
        <>
          <RadioButtonGroup
            onChange={onChangeProfile}
            options={[
              { value: GorillaProfile.standard, label: 'Standard' },
              { value: GorillaProfile.tv, label: 'Zen' },
              { value: GorillaProfile.custom, label: 'Custom' },
            ]}
            value={currentProfile}
          />
          <div className={styles.options}>
            {currentProfile === GorillaProfile.tv &&
              'The zen mode will hide everything except the dashboard panels to remove all distractions. This mode used to be called TV mode.'}
            {currentProfile === GorillaProfile.standard &&
              'The standard kiosk mode will hide the side menu and all the controls from the dashboard top navigation except the title and time controls.'}
            {currentProfile === GorillaProfile.custom &&
              configurableOptions.map((option) => {
                if (!option.value) {
                  return;
                }

                const value = get(config, option.value) as GorillaContextItem;

                return (
                  <div key={option.value}>
                    <Checkbox
                      value={value?.mode === GorillaMode.default}
                      label={option.label}
                      onChange={() => onChangeOption(option.value!)}
                    />
                  </div>
                );
              })}
          </div>
        </>
      </Field>
    </CollapsableSection>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    options: css`
      margin-top: ${theme.spacing(2)};
    `,
  };
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
  const { config, enabled } = useContext(GorillaContext);

  if (!enabled) {
    return {
      dashNav: {
        timePicker: {
          mode: GorillaMode.default,
        },
        title: {
          mode: GorillaMode.default,
        },
        tvToggle: {
          mode: GorillaMode.default,
        },
        addPanelToggle: {
          mode: GorillaMode.default,
        },
        dashboardSettingsToggle: {
          mode: GorillaMode.default,
        },
        saveDashboardToggle: {
          mode: GorillaMode.default,
        },
        snapshotToggle: {
          mode: GorillaMode.default,
        },
        starToggle: {
          mode: GorillaMode.default,
        },
        sharePanelToggle: {
          mode: GorillaMode.default,
        },
      },
      sideMenu: {
        mode: GorillaMode.default,
      },
    };
  }

  return config;
}

export function useGorillaToggler(): () => void {
  const { onToggleEnabled } = useContext(GorillaContext);
  return onToggleEnabled;
}

export function GorillaConfigToggler({ children }: { children: (toggler: () => void) => ReactElement }): JSX.Element {
  const toggler = useGorillaToggler();
  return children(toggler);
}
