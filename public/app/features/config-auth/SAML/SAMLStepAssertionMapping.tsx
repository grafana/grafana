import { css } from '@emotion/css';
import React from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { GrafanaTheme2 } from '@grafana/data';
import { Field, Input, Switch, useStyles2 } from '@grafana/ui';
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

export const SAMLStepAssertionMappingUnconnected = ({
  samlSettings,
  step,
  loadSettings,
  samlStepChanged,
}: Props): JSX.Element => {
  const styles = useStyles2(getStyles);

  return (
    <ConfigStepContainer name="Assertion mapping" onSave={() => {}}>
      <div className={styles.description}>
        Assertion attributes support template mappings. Team sync is available if groups attribute is configured.
      </div>
      <div className={styles.mappingContainer}>
        <div className={styles.mappingHeader}>Assertions and mappings</div>
        <div className={styles.assertionEditorRow}>
          <Input
            width={30}
            id="assertionAttributeName"
            defaultValue="assertion_attribute_name"
            className={styles.inputLabel}
            disabled
          />
          <Input width={3.5} id="assertionAttributeNameEqual" defaultValue="=" className={styles.inputLabel} disabled />
          <Input width={30} id="assertionAttributeNameValue" value={samlSettings['assertion_attribute_name']} />
        </div>
        <div className={styles.assertionEditorRow}>
          <Input
            width={30}
            id="assertionAttributeLogin"
            defaultValue="assertion_attribute_login"
            className={styles.inputLabel}
            disabled
          />
          <Input
            width={3.5}
            id="assertionAttributeLoginEqual"
            defaultValue="="
            className={styles.inputLabel}
            disabled
          />
          <Input width={30} id="assertionAttributeLoginValue" value={samlSettings['assertion_attribute_login']} />
        </div>
      </div>
      <Field label="Skip organization role sync">
        <Switch id="skipOrgRoleSync" onChange={() => {}} />
      </Field>
    </ConfigStepContainer>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    enabledSwitch: css`
      margin-top: ${theme.spacing(2.5)};
    `,
    description: css`
      color: ${theme.colors.text.secondary};
      margin-bottom: ${theme.spacing(2)};
      font-size: ${theme.typography.bodySmall.fontSize};
    `,
    mappingContainer: css`
      background: ${theme.colors.background.secondary};
      padding: ${theme.spacing(2)};
      margin-bottom: ${theme.spacing(4)};
    `,
    mappingHeader: css`
      margin-bottom: ${theme.spacing(2)};
    `,
    assertionEditorRow: css`
      display: flex;
    `,
    inputLabel: css`
      color: ${theme.components.input.text};
      background: ${theme.components.input.background};
    `,
  };
};

export const SAMLStepAssertionMapping = connector(SAMLStepAssertionMappingUnconnected);
