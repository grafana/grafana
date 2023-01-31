import { css } from '@emotion/css';
import React, { FormEvent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { GrafanaTheme2 } from '@grafana/data';
import { Field, Icon, Input, RadioButtonGroup, Switch, Tooltip, useStyles2 } from '@grafana/ui';
import { SettingsSection, StoreState } from 'app/types';

import { ConfigStepContainer } from '../components/ConfigStepContainer';
import { loadSettings } from '../state/actions';
import { samlStepChanged, setSignatureAlgorithm } from '../state/reducers';
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
    signatureAlgorithm: state.authConfig.samlSignatureAlgorithm,
  };
}

const mapDispatchToProps = {
  loadSettings,
  samlStepChanged,
  setSignatureAlgorithm,
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
  loadSettings,
  signatureAlgorithm,
  setSignatureAlgorithm,
  onSettingsUpdate,
  onSave,
}: Props): JSX.Element => {
  // const [signatureAlgorithm, setSignatureAlgorithm] = useState(samlSettings.signature_algorithm || 'rsa-sha256');
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

  const onSignatureOptionChange = () => {
    if (samlSettings.signature_algorithm !== '') {
      onSettingsUpdate({ ...samlSettings, signature_algorithm: '' });
    } else {
      onSettingsUpdate({ ...samlSettings, signature_algorithm: signatureAlgorithm || 'rsa-sha256' });
    }
  };

  const onSignatureAlgorithmChange = (value: string) => {
    setSignatureAlgorithm(value);
    onSettingsUpdate({ ...samlSettings, signature_algorithm: value });
  };

  return (
    <ConfigStepContainer name="Key and certificate" onSave={onSave}>
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
        <Switch id="signRequests" value={samlSettings.signature_algorithm !== ''} onChange={onSignatureOptionChange} />
      </Field>
      {samlSettings.signature_algorithm !== '' && (
        <Field label="Signature algorithm" description="Must be the same as set-up or required by IdP.">
          <RadioButtonGroup
            options={signatureOptions}
            value={signatureAlgorithm || 'rsa-sha256'}
            onChange={onSignatureAlgorithmChange}
          />
        </Field>
      )}
    </ConfigStepContainer>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    enabledSwitch: css`
      margin-top: ${theme.spacing(2.5)};
    `,
    inlineTooltip: css`
      padding-right: ${theme.spacing(1)};
    `,
  };
};

export const SAMLStepKeyCert = connector(SAMLStepKeyCertUnconnected);
