import React, { FC, useState } from 'react';
import { Field, Form } from 'react-final-form';
import { Button, Input, Spinner, TextArea, useTheme } from '@grafana/ui';
import { cx } from 'emotion';
import { getSettingsStyles } from 'app/percona/settings/Settings.styles';
import { Messages } from 'app/percona/settings/Settings.messages';
import { LinkTooltip } from 'app/percona/shared/components/Elements/LinkTooltip/LinkTooltip';
import { getStyles } from './AlertManager.styles';
import { AlertManagerProps } from './AlertManager.types';
import { AlertManagerChangePayload } from '../../Settings.types';

export const AlertManager: FC<AlertManagerProps> = ({ alertManagerUrl, alertManagerRules, updateSettings }) => {
  const theme = useTheme();
  const styles = getStyles(theme);
  const settingsStyles = getSettingsStyles(theme);
  const {
    alertmanager: { action, rulesLabel, rulesLink, rulesTooltip, urlLabel, urlLink, urlTooltip },
    tooltipLinkText,
  } = Messages;
  const [loading, setLoading] = useState(false);
  const initialValues = {
    url: alertManagerUrl,
    rules: alertManagerRules,
  };
  const isEqual = (a: string, b: string) => (!a && !b) || a === b;
  const applyChanges = ({ url, rules }: { url: string; rules: any }) => {
    const body: AlertManagerChangePayload = {
      alert_manager_url: url,
      alert_manager_rules: rules,
    };

    if (!url) {
      body.remove_alert_manager_url = true;
    }

    if (!rules) {
      body.remove_alert_manager_rules = true;
    }

    updateSettings(body, setLoading);
  };

  return (
    <div className={cx(settingsStyles.wrapper, styles.alertManagerWrapper)}>
      <Form
        onSubmit={applyChanges}
        initialValues={initialValues}
        render={({ handleSubmit, pristine }) => (
          <form onSubmit={handleSubmit}>
            <div className={settingsStyles.labelWrapper} data-qa="alertmanager-url-label">
              <span>{urlLabel}</span>
              <LinkTooltip tooltipText={urlTooltip} link={urlLink} linkText={tooltipLinkText} icon="info-circle" />
            </div>
            <Field
              name="url"
              isEqual={isEqual}
              render={({ input }) => <Input {...input} className={styles.input} data-qa="alertmanager-url" />}
            />
            <div className={cx(settingsStyles.labelWrapper, styles.rulesLabel)} data-qa="alertmanager-rules-label">
              <span>{rulesLabel}</span>
              <LinkTooltip tooltipText={rulesTooltip} link={rulesLink} linkText={tooltipLinkText} icon="info-circle" />
            </div>
            <Field
              name="rules"
              isEqual={isEqual}
              render={({ input }) => <TextArea {...input} className={styles.textarea} data-qa="alertmanager-rules" />}
            />
            <Button
              className={settingsStyles.actionButton}
              type="submit"
              disabled={pristine || loading}
              data-qa="alertmanager-button"
            >
              {loading && <Spinner />}
              {action}
            </Button>
          </form>
        )}
      />
    </div>
  );
};
