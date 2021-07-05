import React, { ReactElement, useCallback, useContext } from 'react';
import { css } from '@emotion/css';
import { Checkbox, CollapsableSection, Field, RadioButtonGroup, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { DisplayProfileId, getProfile } from '../profiles';
import { customProfile } from '../profiles/custom';
import { get, set } from 'lodash';
import { DisplayProfileMode } from '../types';
import { getConfig } from 'app/core/config';
import { DisplayProfileContext } from '../state/context';

let currentProfile: DisplayProfileId = DisplayProfileId.tv;

type DisplayProfileSettingsProps = {};

export function DisplayProfileSettings(props: DisplayProfileSettingsProps): ReactElement | null {
  const styles = useStyles2(getStyles);
  const { profile, onChangeProfile } = useContext(DisplayProfileContext);

  const onChange = useCallback(
    (id: DisplayProfileId) => {
      const profileFromId = getProfile(id);

      if (!profileFromId) {
        return;
      }
      currentProfile = id;
      onChangeProfile(profileFromId);
    },
    [onChangeProfile]
  );

  const onChangeOption = useCallback(
    (path: string) => {
      const mode = get(customProfile, path) as DisplayProfileMode;

      if (mode === DisplayProfileMode.default) {
        set(customProfile, path, DisplayProfileMode.hidden);
        onChangeProfile({ ...customProfile });
        return;
      }

      set(customProfile, path, DisplayProfileMode.default);
      onChangeProfile({ ...customProfile });
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
