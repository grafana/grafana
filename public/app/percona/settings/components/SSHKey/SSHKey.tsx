import { cx } from '@emotion/css';
import React, { FC, useCallback, useState } from 'react';
import { Field, Form } from 'react-final-form';

import { Button, Spinner, TextArea, useStyles2 } from '@grafana/ui';
import { Messages } from 'app/percona/settings/Settings.messages';
import { getSettingsStyles } from 'app/percona/settings/Settings.styles';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { LinkTooltip } from 'app/percona/shared/components/Elements/LinkTooltip/LinkTooltip';
import { TabbedPage, TabbedPageContents } from 'app/percona/shared/components/TabbedPage';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { updateSettingsAction } from 'app/percona/shared/core/reducers';
import { getPerconaSettings } from 'app/percona/shared/core/selectors';
import { useAppDispatch } from 'app/store/store';
import { useSelector } from 'app/types';

import { SET_SETTINGS_CANCEL_TOKEN } from '../../Settings.constants';

import { getStyles } from './SSHKey.styles';

export const SSHKey: FC = () => {
  const styles = useStyles2(getStyles);
  const settingsStyles = useStyles2(getSettingsStyles);
  const {
    ssh: { action, label, link, tooltip },
    tooltipLinkText,
  } = Messages;
  const [loading, setLoading] = useState(false);
  const [generateToken] = useCancelToken();
  const { result: settings } = useSelector(getPerconaSettings);
  const dispatch = useAppDispatch();
  const { sshKey } = settings!;
  const isEqual = (a: string, b: string) => (!a && !b) || a === b;

  const applyChanges = useCallback(async ({ key }: { key: string }) => {
    setLoading(true);
    await dispatch(
      updateSettingsAction({
        body: { ssh_key: key },
        token: generateToken(SET_SETTINGS_CANCEL_TOKEN),
      })
    );
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <TabbedPage navId="settings-ssh" vertical>
      <TabbedPageContents dataTestId="settings-tab-content" className={settingsStyles.pageContent}>
        <FeatureLoader>
          <div className={cx(settingsStyles.wrapper, styles.sshKeyWrapper)}>
            <Form
              onSubmit={applyChanges}
              initialValues={{ key: sshKey }}
              render={({ handleSubmit, pristine }) => (
                <form onSubmit={handleSubmit}>
                  <div className={settingsStyles.labelWrapper} data-testid="ssh-key-label">
                    <span>{label}</span>
                    <LinkTooltip tooltipContent={tooltip} link={link} linkText={tooltipLinkText} icon="info-circle" />
                  </div>
                  <Field
                    name="key"
                    isEqual={isEqual}
                    render={({ input }) => <TextArea {...input} className={styles.textarea} data-testid="ssh-key" />}
                  />
                  <Button
                    className={settingsStyles.actionButton}
                    type="submit"
                    disabled={pristine || loading}
                    data-testid="ssh-key-button"
                  >
                    {loading && <Spinner />}
                    {action}
                  </Button>
                </form>
              )}
            />
          </div>
        </FeatureLoader>
      </TabbedPageContents>
    </TabbedPage>
  );
};

export default SSHKey;
