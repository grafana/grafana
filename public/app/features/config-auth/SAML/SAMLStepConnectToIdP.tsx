import { css } from '@emotion/css';
import React from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { GrafanaTheme2 } from '@grafana/data';
import { ClipboardButton, Field, Input, RadioButtonGroup, useStyles2 } from '@grafana/ui';
import { SettingsSection, StoreState } from 'app/types';

import { ConfigStepContainer } from '../components/ConfigStepContainer';
import { loadSettings } from '../state/actions';
import { samlStepChanged } from '../state/reducers';
import { selectSamlConfig } from '../state/selectors';

interface OwnProps {
  onSettingsUpdate: (samlSettings: SettingsSection) => void;
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

const metadataOptions = [
  { label: 'URL to metadata', value: 'url' },
  { label: 'Path to downloaded files', value: 'path' },
];

export const SAMLStepConnectToIdPUnconnected = ({
  samlSettings,
  step,
  loadSettings,
  samlStepChanged,
  onSettingsUpdate,
}: Props): JSX.Element => {
  const styles = useStyles2(getStyles);

  return (
    <ConfigStepContainer name="Connect Grafana with Identity Provider" onSave={() => {}}>
      <div className={styles.externalBorder}>
        <div className={styles.doubleSideContainer}>
          <div className={styles.internalContainer}>
            <div className={styles.internalContainerHeader}>
              <div className={styles.stepNumber}>1</div>
              <h4>Configure IdP using Grafana metadata</h4>
            </div>
            <div className={styles.internalContainerBody}>
              <div className={styles.description}>
                To configure your identity provider (IdP) you will need the Grafana metadata URLs. All below endpoints
                must be reachable by your Identity Provider (IdP).
              </div>
              <Field
                label="Metadata"
                description="Identifier / Audience URI / SP Entity ID / SP Issuer / Client ID / Client SAML Endpoint / Master SAML Processing URL"
              >
                <div className={styles.inputWithCopyToClipboard}>
                  <Input width={50} id="spMetadata" onChange={() => {}} />
                  <ClipboardButton
                    className={styles.copyToClipboardButton}
                    variant="primary"
                    size="md"
                    icon="copy"
                    getText={() => ''}
                  >
                    Copy
                  </ClipboardButton>
                </div>
              </Field>
              <Field
                label="ACS"
                description="Reply URL / Assertion Consumer Service URL / Single sign on URL / Valid Redirect URIs / ACS POST binding URL"
              >
                <div className={styles.inputWithCopyToClipboard}>
                  <Input width={50} id="spACS" onChange={() => {}} />
                  <ClipboardButton
                    className={styles.copyToClipboardButton}
                    variant="primary"
                    size="md"
                    icon="copy"
                    getText={() => ''}
                  >
                    Copy
                  </ClipboardButton>
                </div>
              </Field>
              <Field label="SLO" description="Single log out URL /  Logout service redirect binding URL">
                <div className={styles.inputWithCopyToClipboard}>
                  <Input width={50} id="spSLO" onChange={() => {}} />
                  <ClipboardButton
                    className={styles.copyToClipboardButton}
                    variant="primary"
                    size="md"
                    icon="copy"
                    getText={() => ''}
                  >
                    Copy
                  </ClipboardButton>
                </div>
              </Field>
            </div>
          </div>
          <div className={styles.internalContainer}>
            <div className={styles.internalContainerHeader}>
              <div className={styles.stepNumber}>2</div>
              <h4>Finish configuring Grafana using IdP data</h4>
            </div>
            <div className={styles.internalContainerBody}>
              <div className={styles.description}>
                Visit your IdP&apos;s configuration panel, add new app and use metadata from step one to connect with
                Grafana. You will need to copy your IdP&apos;s metadata and provide it below. Test connection and copy
                assertion labels/values.
              </div>
              <Field label="IdP's metadata " description="Must be the same as set-up or required by IdP.">
                <RadioButtonGroup options={metadataOptions} value={'url'} onChange={() => {}} />
              </Field>
              <Field label="IdP's metadata URL" description="App Federation Metadata URL">
                <Input width={60} id="metadataUrl" onChange={() => {}} />
              </Field>
              <div className={styles.description}>
                If you want to test the connection from your IdP&apos;s panel make sure to allow IdP initiated login and
                provide the relay state information.
              </div>
            </div>
          </div>
        </div>
        <div className={styles.internalContainerHeader}>
          <div className={styles.stepNumber}>3</div>
          <h4>Configure assertions, group, group and org mappings in the next step.</h4>
        </div>
      </div>
    </ConfigStepContainer>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    inlineTooltip: css`
      padding-right: ${theme.spacing(1)};
    `,
    description: css`
      color: ${theme.colors.text.secondary};
      margin-bottom: ${theme.spacing(2)};
      font-size: ${theme.typography.bodySmall.fontSize};
    `,
    externalBorder: css`
      border-radius: ${theme.shape.borderRadius(1)};
      border: 1px solid ${theme.colors.border.medium};
    `,
    doubleSideContainer: css`
      display: flex;
      flex-direction: row;
      justify-content: space-around;
    `,
    internalContainer: css`
      flex: 1 1 0;
      border-bottom: 1px solid ${theme.colors.border.medium};
      &:first-child {
        border-right: 1px solid ${theme.colors.border.medium};
      }
    `,
    internalContainerHeader: css`
      display: flex;
      justify-content: center;
      border-bottom: 1px solid ${theme.colors.border.medium};
      padding: ${theme.spacing(2)};
      text-align: center;
      h4 {
        margin-bottom: 0;
      }
    `,
    internalContainerBody: css`
      padding: ${theme.spacing(2)};
    `,
    stepNumber: css`
      border: 1px solid ${theme.colors.background.secondary};
      border-radius: ${theme.shape.borderRadius(4)};
      background: ${theme.colors.background.secondary};
      color: ${theme.colors.text.secondary};
      width: ${theme.spacing(3)};
      height: ${theme.spacing(3)};
      margin-right: ${theme.spacing(1)};
      font-weight: ${theme.typography.fontWeightBold};
    `,
    copyToClipboardButton: css`
      border-top-left-radius: 0px;
      border-bottom-left-radius: 0px;
    `,
    inputWithCopyToClipboard: css`
      padding: 0;
      display: flex;
    `,
  };
};

export const SAMLStepConnectToIdP = connector(SAMLStepConnectToIdPUnconnected);
