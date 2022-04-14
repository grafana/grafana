import React, { FC, useState } from 'react';
import { Field, Form } from 'react-final-form';
import { Button, Input, Spinner, TextArea, useTheme } from '@grafana/ui';
import { cx } from '@emotion/css';
import { getSettingsStyles } from 'app/percona/settings/Settings.styles';
import { Messages } from 'app/percona/settings/Settings.messages';
import { LinkTooltip } from 'app/percona/shared/components/Elements/LinkTooltip/LinkTooltip';
import { getStyles } from './AlertManager.styles';
import { AlertManagerProps } from './AlertManager.types';
import { AlertManagerChangePayload } from '../../Settings.types';
import { AM_WARNING_URL } from '../../Settings.constants';

export const AlertManager: FC<AlertManagerProps> = ({ alertManagerUrl, alertManagerRules, updateSettings }) => {
  const theme = useTheme();
  const styles = getStyles(theme);
  const settingsStyles = getSettingsStyles(theme);
  const {
    alertmanager: {
      action,
      rulesLabel,
      rulesLink,
      rulesTooltip,
      urlLabel,
      urlLink,
      urlTooltip,
      warningPre,
      warningLinkContent,
      warningPost,
    },
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
          <form onSubmit={handleSubmit} data-testid="alert-manager-form">
            <div className={settingsStyles.labelWrapper} data-testid="alertmanager-url-label">
              <strong className={styles.warning}>
                {warningPre}{' '}
                <a className={styles.warningLink} href={AM_WARNING_URL}>
                  {warningLinkContent}
                </a>{' '}
                {warningPost}
              </strong>
              <span>{urlLabel}</span>
              <LinkTooltip tooltipText={urlTooltip} link={urlLink} linkText={tooltipLinkText} icon="info-circle" />
            </div>
            <Field
              name="url"
              isEqual={isEqual}
              render={({ input }) => <Input {...input} className={styles.input} data-testid="alertmanager-url" />}
            />
            <div className={cx(settingsStyles.labelWrapper, styles.rulesLabel)} data-testid="alertmanager-rules-label">
              <span>{rulesLabel}</span>
              <LinkTooltip tooltipText={rulesTooltip} link={rulesLink} linkText={tooltipLinkText} icon="info-circle" />
            </div>
            <Field
              name="rules"
              isEqual={isEqual}
              render={({ input }) => (
                <TextArea {...input} className={styles.textarea} data-testid="alertmanager-rules" />
              )}
            />
            <Button
              className={settingsStyles.actionButton}
              type="submit"
              disabled={pristine || loading}
              data-testid="alertmanager-button"
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
