import { css } from '@emotion/css';
import React from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { GrafanaTheme2 } from '@grafana/data';
import { Field, HorizontalGroup, InlineSwitch, Input, Switch, useStyles2 } from '@grafana/ui';
import { StoreState } from 'app/types';

import { ConfigStepContainer } from '../components/ConfigStepContainer';
import { loadSettings } from '../state/actions';
import { samlStepChanged } from '../state/reducers';
import { selectSamlConfig } from '../state/selectors';

interface OwnProps {}

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
}: Props): JSX.Element => {
  const styles = useStyles2(getStyles);

  const onStepChange = (step: number) => {
    console.log(step);
    samlStepChanged(step);
  };

  return (
    <ConfigStepContainer name="General settings" onStepChange={() => onStepChange(step + 1)}>
      <HorizontalGroup>
        <Field
          label="Display name for this SAML 2.0 intergration"
          description="Helpful if you use more than one SSO IdP provider or protocol."
        >
          <Input id="displayName" placeholder="SAML 2.0 SSO" onChange={() => {}} />
        </Field>
        <span className={styles.enabledSwitch}>
          <InlineSwitch label="Enabled" showLabel={true} value={samlSettings.enabled === 'true'} />
        </span>
      </HorizontalGroup>
      <Field label="Single logout" description="Remember to set single logout metadata">
        <Switch id="singleLogout" onChange={() => {}} />
      </Field>
      <Field
        label="Allow signup"
        description="Whether to allow new Grafana user creation through SAML login. If set to false, then only existing Grafana users can log in with SAML."
      >
        <Switch id="allowSignup" onChange={() => {}} />
      </Field>
      <Field label="Allow Identity Provider initiated login" description="">
        <Switch id="allowIdpInitiated" onChange={() => {}} />
      </Field>
      <Field
        label="Relay state"
        description="Relay state for IdP-initiated login. Should match relay state configured in IdP and trailing space is required."
      >
        <Input width={60} id="relayState" onChange={() => {}} />
      </Field>
      <Field
        label="Max issue delay"
        description="Duration, since the IdP issued a response and the SP is allowed to process it."
      >
        <Input width={24} id="maxIssueDelay" placeholder="90s" onChange={() => {}} />
      </Field>
      <Field label="Metadata valid duration" description="Duration, for how long the SP metadata is valid.">
        <Input width={24} id="metadataValidDuration" placeholder="48h" onChange={() => {}} />
      </Field>
    </ConfigStepContainer>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css`
      display: flex;
      height: ${theme.spacing(6)};
      padding: ${theme.spacing(2)};
      margin: ${theme.spacing(2)} 0;
      border-radius: ${theme.shape.borderRadius(1)};
      border: 1px solid ${theme.colors.border.medium};
    `,
    stepContainer: css`
      cursor: pointer;
      color: ${theme.colors.text.secondary};
    `,
    active: css`
      color: ${theme.colors.text.primary};
    `,
    separator: css`
      color: ${theme.colors.secondary.shade};
      white-space: nowrap;
    `,
    icon: css`
      color: ${theme.colors.success.text};
    `,
    enabledSwitch: css`
      margin-top: ${theme.spacing(2.5)};
    `,
  };
};

export const SAMLStepGeneral = connector(SAMLStepGeneralUnconnected);
