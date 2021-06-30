import React, { ReactElement, useContext, useMemo, useState, useCallback } from 'react';
import { get, set } from 'lodash';
import { DashNav, OwnProps as DashNavProps } from '../components/DashNav';
import { selectors } from '@grafana/e2e-selectors';
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

export enum GorillaProfile {
  standard = 'standard',
  tv = 'tv',
  custom = 'custom',
}

export enum GorillaMode {
  hidden = 'hidden',
  readOnly = 'readOnly',
  editable = 'editable',
}

const standardProfile = {
  profile: GorillaProfile.standard,
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
    addPanelToggle: {
      mode: GorillaMode.editable,
    },
    dashboardSettingsToggle: {
      mode: GorillaMode.editable,
    },
    saveDashboardToggle: {
      mode: GorillaMode.editable,
    },
    snapshotToggle: {
      mode: GorillaMode.editable,
    },
  },
};

const tvProfile = {
  profile: GorillaProfile.tv,
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
    addPanelToggle: {
      mode: GorillaMode.editable,
    },
    dashboardSettingsToggle: {
      mode: GorillaMode.editable,
    },
    saveDashboardToggle: {
      mode: GorillaMode.editable,
    },
    snapshotToggle: {
      mode: GorillaMode.editable,
    },
  },
};

const customProfile = {
  profile: GorillaProfile.custom,
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
    addPanelToggle: {
      mode: GorillaMode.editable,
    },
    dashboardSettingsToggle: {
      mode: GorillaMode.editable,
    },
    saveDashboardToggle: {
      mode: GorillaMode.editable,
    },
    snapshotToggle: {
      mode: GorillaMode.editable,
    },
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
export interface GorillaDashNavItem extends GorillaContextItem {
  timePicker: GorillaContextItem;
  title: GorillaContextItem;
  tvToggle: GorillaContextItem;
  addPanelToggle: GorillaContextItem;
  dashboardSettingsToggle: GorillaContextItem;
  saveDashboardToggle: GorillaContextItem;
  snapshotToggle: GorillaContextItem;
}

export interface GorillaContextType {
  onChangeConfig: GorillaChangeConfigCallback;
  config: GorillaContextConfiguration;
}

export type GorillaChangeConfigCallback = (config: GorillaContextConfiguration) => void;

export interface GorillaContextConfiguration {
  profile: GorillaProfile;
  dashNav: GorillaDashNavItem;
}

export const GorillaContext = React.createContext<GorillaContextType>({
  config: standardProfile,
  onChangeConfig: () => {},
});

export function GorillaProvider({ children }: React.PropsWithChildren<any>): JSX.Element {
  const [config, setConfig] = useState(standardProfile);
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
    case GorillaMode.hidden: {
      return null;
    }

    default:
      return (
        <div aria-label={selectors.pages.Dashboard.DashNav.nav}>
          <DashNav {...props} />
        </div>
      );
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

type GorillaSettingsProps = {};

export function GorillaSettings(props: GorillaSettingsProps): ReactElement | null {
  const { profile } = useGorillaConfig();
  const onChangeConfig = useGorillaConfigChanger();
  const styles = useStyles2(getStyles);

  const onChangeProfile = useCallback(
    (profile: GorillaProfile) => {
      const configuration = profileRegistry[profile];

      if (!configuration) {
        return;
      }

      onChangeConfig(configuration);
    },
    [onChangeConfig]
  );

  const onChangeOption = useCallback(
    (path: string) => {
      const current = get(customProfile, path) as GorillaContextItem;
      const copy = { ...customProfile };

      if (current?.mode === GorillaMode.editable) {
        set(copy, path, { mode: GorillaMode.hidden });
        onChangeConfig(copy);
        return;
      }

      set(copy, path, { mode: GorillaMode.editable });
      onChangeConfig(copy);
    },
    [onChangeConfig]
  );

  if (!getConfig().featureToggles.customKiosk) {
    return null;
  }

  const currentProfile = profileRegistry[profile];

  const configurableOptions: Array<SelectableValue<string>> = [
    { value: 'dashNav.timePicker', label: 'Time picker' },
    { value: 'dashNav.title', label: 'Title' },
    { value: 'dashNav.tvToggle', label: 'Kiosk mode button' },
    { value: 'dashNav.addPanelToggle', label: 'Add panel button' },
    { value: 'dashNav.dashboardSettingsToggle', label: 'Settings button' },
    { value: 'dashNav.saveDashboardToggle', label: 'Save button' },
    { value: 'dashNav.snapshotToggle', label: 'Snapshot Button' },
  ];

  return (
    <CollapsableSection label="Kiosk options" isOpen={true}>
      <Field label="Kiosk type" description="Controls what UI components will be displayed in dashboard kiosk mode.">
        <>
          <RadioButtonGroup
            onChange={onChangeProfile}
            options={[
              { value: GorillaProfile.standard, label: 'Standard' },
              { value: GorillaProfile.tv, label: 'TV' },
              { value: GorillaProfile.custom, label: 'Custom' },
            ]}
            value={profile}
          />
          <div className={styles.options}>
            {configurableOptions.map((option) => {
              if (!option.value) {
                return;
              }

              const value = get(currentProfile, option.value) as GorillaContextItem;
              return (
                <div key={option.value}>
                  <Checkbox
                    value={value?.mode === GorillaMode.editable}
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
  const { config } = useContext(GorillaContext);
  return config;
}
