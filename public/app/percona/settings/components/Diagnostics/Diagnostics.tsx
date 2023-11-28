import React, { FC } from 'react';

import { Icon, LinkButton, Tooltip, useStyles2 } from '@grafana/ui';
import { Messages } from 'app/percona/settings/Settings.messages';
import { getSettingsStyles } from 'app/percona/settings/Settings.styles';

import { getStyles } from './Diagnostics.styles';

export const Diagnostics: FC<React.PropsWithChildren<unknown>> = () => {
  const styles = useStyles2(getStyles);
  const settingsStyles = useStyles2(getSettingsStyles);
  const {
    diagnostics: { action, label, tooltip },
  } = Messages;

  return (
    <div className={styles.diagnosticsWrapper}>
      <div className={settingsStyles.labelWrapper} data-testid="diagnostics-label">
        {label}
        <Tooltip content={tooltip}>
          <div>
            <Icon name="info-circle" />
          </div>
        </Tooltip>
      </div>
      <LinkButton
        target="_blank"
        href="/logs.zip"
        className={styles.diagnosticsButton}
        variant="secondary"
        data-testid="diagnostics-button"
      >
        <Icon name="download-alt" />
        <span>{action}</span>
      </LinkButton>
    </div>
  );
};
