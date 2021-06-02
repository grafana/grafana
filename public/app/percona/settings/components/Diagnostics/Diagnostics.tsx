import React, { FC } from 'react';
import { Icon, LinkButton, Tooltip, useTheme } from '@grafana/ui';
import { Messages } from 'app/percona/settings/Settings.messages';
import { getSettingsStyles } from 'app/percona/settings/Settings.styles';
import { getStyles } from './Diagnostics.styles';

export const Diagnostics: FC = () => {
  const theme = useTheme();
  const styles = getStyles(theme);
  const settingsStyles = getSettingsStyles(theme);
  const {
    diagnostics: { action, label, tooltip },
  } = Messages;

  return (
    <div className={styles.diagnosticsWrapper}>
      <div className={settingsStyles.labelWrapper} data-qa="diagnostics-label">
        {label}
        <Tooltip content={tooltip}>
          <div>
            <Icon name="info-circle" />
          </div>
        </Tooltip>
      </div>
      <LinkButton
        href="/logs.zip"
        className={styles.diagnosticsButton}
        variant="secondary"
        data-qa="diagnostics-button"
      >
        <Icon name="download-alt" />
        <span>{action}</span>
      </LinkButton>
    </div>
  );
};
