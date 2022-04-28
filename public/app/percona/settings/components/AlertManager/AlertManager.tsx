import React, { FC, useState } from 'react';
import { Field, Form } from 'react-final-form';
import { Button, Input, Spinner, TextArea, useStyles2 } from '@grafana/ui';
import { cx } from '@emotion/css';
import { useSelector } from 'react-redux';
import { useAppDispatch } from 'app/store/store';
import { getPerconaSettings } from 'app/percona/shared/core/selectors';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { updateSettingsAction } from 'app/percona/shared/core/reducers';
import { SET_SETTINGS_CANCEL_TOKEN, AM_WARNING_URL } from '../../Settings.constants';
import Page from 'app/core/components/Page/Page';
import { usePerconaNavModel } from 'app/percona/shared/components/hooks/perconaNavModel';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { getSettingsStyles } from 'app/percona/settings/Settings.styles';
import { Messages } from 'app/percona/settings/Settings.messages';
import { LinkTooltip } from 'app/percona/shared/components/Elements/LinkTooltip/LinkTooltip';
import { getStyles } from './AlertManager.styles';
import { AlertManagerChangePayload } from '../../Settings.types';
import { WithDiagnostics } from '../WithDiagnostics/WithDiagnostics';

export const AlertManager: FC = () => {
  const styles = useStyles2(getStyles);
  const settingsStyles = useStyles2(getSettingsStyles);
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
  const [generateToken] = useCancelToken();
  const { result: settings } = useSelector(getPerconaSettings);
  const dispatch = useAppDispatch();
  const navModel = usePerconaNavModel('settings-alert-manager');
  const { alertManagerUrl, alertManagerRules } = settings!;
  const initialValues = {
    url: alertManagerUrl,
    rules: alertManagerRules,
  };
  const isEqual = (a: string, b: string) => (!a && !b) || a === b;

  const applyChanges = async ({ url, rules }: { url: string; rules: any }) => {
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

    setLoading(true);
    await dispatch(
      updateSettingsAction({
        body,
        token: generateToken(SET_SETTINGS_CANCEL_TOKEN),
      })
    );
    setLoading(false);
  };

  return (
    <Page navModel={navModel} vertical tabsDataTestId="settings-tabs">
      <Page.Contents dataTestId="settings-tab-content" className={settingsStyles.pageContent}>
        <FeatureLoader>
          <WithDiagnostics>
            <div className={cx(settingsStyles.wrapper, styles.alertManagerWrapper)}>
              <Form
                onSubmit={applyChanges}
                initialValues={initialValues}
                render={({ handleSubmit, pristine }) => (
                  <form onSubmit={handleSubmit}>
                    <div className={settingsStyles.labelWrapper} data-testid="alertmanager-url-label">
                      <strong className={styles.warning}>
                        {warningPre}{' '}
                        <a className={styles.warningLink} href={AM_WARNING_URL}>
                          {warningLinkContent}
                        </a>{' '}
                        {warningPost}
                      </strong>
                      <span>{urlLabel}</span>
                      <LinkTooltip
                        tooltipText={urlTooltip}
                        link={urlLink}
                        linkText={tooltipLinkText}
                        icon="info-circle"
                      />
                    </div>
                    <Field
                      name="url"
                      isEqual={isEqual}
                      render={({ input }) => (
                        <Input {...input} className={styles.input} data-testid="alertmanager-url" />
                      )}
                    />
                    <div
                      className={cx(settingsStyles.labelWrapper, styles.rulesLabel)}
                      data-testid="alertmanager-rules-label"
                    >
                      <span>{rulesLabel}</span>
                      <LinkTooltip
                        tooltipText={rulesTooltip}
                        link={rulesLink}
                        linkText={tooltipLinkText}
                        icon="info-circle"
                      />
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
          </WithDiagnostics>
        </FeatureLoader>
      </Page.Contents>
    </Page>
  );
};

export default AlertManager;
