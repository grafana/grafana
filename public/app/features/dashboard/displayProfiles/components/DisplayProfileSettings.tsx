import React, { ReactElement, useCallback } from 'react';
import { css } from '@emotion/css';
import { Checkbox, CollapsableSection, Field, RadioButtonGroup, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { DisplayProfileId, getDisplayProfile } from '../profiles';
import { customProfile } from '../profiles/custom';
import { get, set } from 'lodash';
import { DisplayProfileMode } from '../types';
import { getConfig } from 'app/core/config';
import { useDisplayProfileId, useOnChangeDisplayProfile } from '../state/hooks';

type DisplayProfileSettingsProps = {};

export function DisplayProfileSettings(props: DisplayProfileSettingsProps): ReactElement | null {
  const styles = useStyles2(getStyles);
  const currentProfile = useDisplayProfileId();
  const profile = getDisplayProfile(currentProfile);
  const onChangeProfile = useOnChangeDisplayProfile();

  console.log('currentProfile', currentProfile);

  const onChange = useCallback(
    (id: DisplayProfileId) => {
      const profileConfig = getDisplayProfile(id);

      if (!profileConfig) {
        return;
      }

      onChangeProfile(id);
    },
    [onChangeProfile]
  );

  const onChangeOption = useCallback(
    (path: string) => {
      const mode = get(customProfile, path) as DisplayProfileMode;

      if (mode === DisplayProfileMode.default) {
        set(customProfile, path, DisplayProfileMode.hidden);
        onChangeProfile(DisplayProfileId.custom);
        return;
      }

      set(customProfile, path, DisplayProfileMode.default);
      onChangeProfile(DisplayProfileId.custom);
    },
    [onChangeProfile]
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
    { value: 'dashNav.dashboardSettingsToggle', label: 'Settings button' },
    { value: 'dashNav.saveDashboardToggle', label: 'Save button' },
  ];

  return (
    <CollapsableSection label="Kiosk options" isOpen={true}>
      <Field label="Kiosk type" description="Controls what UI components will be displayed in dashboard kiosk mode.">
        <>
          <RadioButtonGroup
            onChange={onChange}
            options={[
              { value: DisplayProfileId.tv, label: 'TV' },
              { value: DisplayProfileId.kiosk, label: 'Zen' },
              { value: DisplayProfileId.custom, label: 'Custom' },
            ]}
            value={currentProfile}
          />
          <div className={styles.options}>
            {currentProfile === DisplayProfileId.tv &&
              'The TV mode will hide the side menu and all the controls from the dashboard top navigation except the title and time controls.'}
            {currentProfile === DisplayProfileId.kiosk &&
              'The zen mode will hide everything except the dashboard panels to remove all distractions.'}
            {currentProfile === DisplayProfileId.custom &&
              configurableOptions.map((option) => {
                if (!option.value) {
                  return;
                }

                const mode = get(profile, option.value) as DisplayProfileMode;

                return (
                  <div key={option.value}>
                    <Checkbox
                      value={mode === DisplayProfileMode.default}
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
