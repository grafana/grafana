import React, { FC, useState } from 'react';
import { cx } from 'emotion';
import { Field, Form } from 'react-final-form';
import { Button, Spinner, TextArea, useTheme } from '@grafana/ui';
import { getSettingsStyles } from 'app/percona/settings/Settings.styles';
import { Messages } from 'app/percona/settings/Settings.messages';
import { LinkTooltip } from 'app/percona/shared/components/Elements/LinkTooltip/LinkTooltip';
import { getStyles } from './SSHKey.styles';
import { SSHKeyProps } from './SSHKey.types';

export const SSHKey: FC<SSHKeyProps> = ({ sshKey, updateSettings }) => {
  const theme = useTheme();
  const styles = getStyles(theme);
  const settingsStyles = getSettingsStyles(theme);
  const {
    ssh: { action, label, link, tooltip },
    tooltipLinkText,
  } = Messages;
  const [loading, setLoading] = useState(false);
  const isEqual = (a: string, b: string) => !(a && !b) || a === b;
  const applyChanges = ({ key }: { key: string }) => {
    const body = { ssh_key: key };

    updateSettings(body, setLoading);
  };

  return (
    <div className={cx(settingsStyles.wrapper, styles.sshKeyWrapper)}>
      <Form
        onSubmit={applyChanges}
        initialValues={{ key: sshKey }}
        render={({ handleSubmit, pristine }) => (
          <form onSubmit={handleSubmit}>
            <div className={settingsStyles.labelWrapper} data-qa="ssh-key-label">
              <span>{label}</span>
              <LinkTooltip tooltipText={tooltip} link={link} linkText={tooltipLinkText} icon="info-circle" />
            </div>
            <Field
              name="key"
              isEqual={isEqual}
              render={({ input }) => <TextArea {...input} className={styles.textarea} data-qa="ssh-key" />}
            />
            <Button
              className={settingsStyles.actionButton}
              type="submit"
              disabled={pristine || loading}
              data-qa="ssh-key-button"
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
