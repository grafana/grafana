import { css } from '@emotion/css';
import React from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { GrafanaTheme2 } from '@grafana/data';
import { Field, Icon, Input, RadioButtonGroup, Switch, Tooltip, useStyles2 } from '@grafana/ui';
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

const certOptions = [
  { label: 'Path to file', value: 'path' },
  { label: 'Base64-encoded content', value: 'base64' },
];

const signatureOptions = [
  { label: 'RSA-SHA256 (default)', value: 'rsa-sha256' },
  { label: 'RSA-SHA512', value: 'rsa-sha512' },
  { label: 'RSA-SHA1', value: 'rsa-sha1' },
];

export const SAMLStepKeyCertUnconnected = ({
  samlSettings,
  step,
  loadSettings,
  samlStepChanged,
}: Props): JSX.Element => {
  const styles = useStyles2(getStyles);

  const onStepChange = (step: number) => {
    samlStepChanged(step);
  };

  return (
    <ConfigStepContainer name="Key and certificate" onStepChange={() => onStepChange(step + 1)}>
      <Field
        label="Signing and encryption key and certificate provision specification (required)"
        description="X.509 certificate provides the public part, while the private key issued in a PKCS#8 format provides the private part of the asymmetric encryption."
      >
        <RadioButtonGroup options={certOptions} value={'path'} onChange={() => {}} />
      </Field>
      <Field
        label={
          <div>
            <span className={styles.inlineTooltip}>Key path</span>
            <Tooltip
              placement="right"
              content="Example: $ openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes​"
              interactive
            >
              <Icon name="question-circle" />
            </Tooltip>
          </div>
        }
      >
        <Input width={60} id="keyPath" onChange={() => {}} />
      </Field>
      <Field label="Certicficate path">
        <Input width={60} id="certPath" onChange={() => {}} />
      </Field>
      <Field label="Sign requests">
        <Switch id="signRequests" onChange={() => {}} />
      </Field>
      <Field label="Signature algorithm" description="Must be the same as set-up or required by IdP.">
        <RadioButtonGroup options={signatureOptions} value={samlSettings.signature_algorithm} onChange={() => {}} />
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
    inlineTooltip: css`
      padding-right: ${theme.spacing(1)};
    `,
  };
};

export const SAMLStepKeyCert = connector(SAMLStepKeyCertUnconnected);
