import { css } from '@emotion/css';
import React, { FormEvent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { GrafanaTheme2 } from '@grafana/data';
import { Field, HorizontalGroup, InlineSwitch, Input, Switch, useStyles2 } from '@grafana/ui';
import { SettingsSection, StoreState } from 'app/types';

import { ConfigStepContainer } from '../components/ConfigStepContainer';
import { loadSettings } from '../state/actions';
import { samlStepChanged } from '../state/reducers';
import { selectSamlConfig } from '../state/selectors';

interface OwnProps {
  onSettingsUpdate: (samlSettings: SettingsSection) => void;
  onSave: () => void;
}

export type Props = OwnProps & ConnectedProps<typeof connector>;

function mapStateToProps(state: StoreState) {
  return {
    settings: state.authConfig.settings,
    step: state.authConfig.samlStep,
    samlSettings: selectSamlConfig(state.authConfig),
  };
}

const mapDispatchToProps = {
  loadSettings,
  samlStepChanged,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export const SAMLStepGeneralUnconnected = ({
  samlSettings,
  step,
  loadSettings,
  samlStepChanged,
  onSettingsUpdate,
  onSave,
}: Props): JSX.Element => {
  const styles = useStyles2(getStyles);

  const onPropChange = (prop: string) => {
    return (event: FormEvent<HTMLInputElement>) => {
      const value = event.currentTarget.value;
      onSettingsUpdate({ ...samlSettings, [prop]: value });
    };
  };

  const onBooleanPropChange = (prop: string) => {
    return (event: FormEvent<HTMLInputElement>) => {
      const value = samlSettings[prop] === 'true' ? 'false' : 'true';
      onSettingsUpdate({ ...samlSettings, [prop]: value });
    };
  };

  return (
    <ConfigStepContainer name="General settings" onSave={onSave}>
      <HorizontalGroup>
        <Field
          label="Display name for this SAML 2.0 intergration"
          description="Helpful if you use more than one SSO IdP provider or protocol."
        >
          <Input id="displayName" placeholder="SAML 2.0 SSO" onChange={() => {}} />
        </Field>
        <span className={styles.enabledSwitch}>
          <InlineSwitch
            label="Enabled"
            showLabel={true}
            value={samlSettings.enabled === 'true'}
            onChange={onBooleanPropChange('enabled')}
          />
        </span>
      </HorizontalGroup>
      <Field label="Single logout" description="Remember to set single logout metadata">
        <Switch
          id="singleLogout"
          value={samlSettings.single_logout === 'true'}
          onChange={onBooleanPropChange('single_logout')}
        />
      </Field>
      <Field
        label="Allow signup"
        description="Whether to allow new Grafana user creation through SAML login. If set to false, then only existing Grafana users can log in with SAML."
      >
        <Switch
          id="allowSignup"
          value={samlSettings.allow_sign_up === 'true'}
          onChange={onBooleanPropChange('allow_sign_up')}
        />
      </Field>
      <Field label="Allow Identity Provider initiated login" description="">
        <Switch
          id="allowIdpInitiated"
          value={samlSettings.allow_idp_initiated === 'true'}
          onChange={onBooleanPropChange('allow_idp_initiated')}
        />
      </Field>
      <Field
        label="Relay state"
        description="Relay state for IdP-initiated login. Should match relay state configured in IdP and trailing space is required."
      >
        <Input
          width={60}
          id="relayState"
          value={samlSettings['relay_state'] || ''}
          onChange={onPropChange('relay_state')}
        />
      </Field>
      <Field
        label="Max issue delay"
        description="Duration, since the IdP issued a response and the SP is allowed to process it."
      >
        <Input
          width={24}
          id="maxIssueDelay"
          placeholder="90s"
          value={samlSettings['max_issue_delay']}
          onChange={onPropChange('max_issue_delay')}
        />
      </Field>
      <Field label="Metadata valid duration" description="Duration, for how long the SP metadata is valid.">
        <Input
          width={24}
          id="metadataValidDuration"
          placeholder="48h"
          value={samlSettings['metadata_valid_duration']}
          onChange={onPropChange('metadata_valid_duration')}
        />
      </Field>
    </ConfigStepContainer>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    enabledSwitch: css`
      margin-top: ${theme.spacing(2.5)};
    `,
  };
};

export const SAMLStepGeneral = connector(SAMLStepGeneralUnconnected);
