import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, LinkButton, useStyles2 } from '@grafana/ui';
import { AccessControlAction } from 'app/types/accessControl';

import { contextSrv } from '../../../../core/core';
import { ROUTES } from '../../constants';

const getStyles = (theme: GrafanaTheme2) => ({
  alertContent: css({
    display: 'flex',
    flexDirection: 'row',
    padding: 0,
    justifyContent: 'space-between',
    alignItems: 'center',
  }),
  alertParagraph: css({
    margin: theme.spacing(0, 1, 0, 0),
    lineHeight: theme.spacing(theme.components.height.sm),
  }),
});

export function ConnectionsRedirectNotice() {
  const styles = useStyles2(getStyles);
  const canAccessDataSources =
    contextSrv.hasPermission(AccessControlAction.DataSourcesCreate) ||
    contextSrv.hasPermission(AccessControlAction.DataSourcesWrite);
  const [showNotice, setShowNotice] = useState(canAccessDataSources);

  return showNotice ? (
    <Alert severity="info" title="" onRemove={() => setShowNotice(false)}>
      <div className={styles.alertContent}>
        <p className={styles.alertParagraph}>
          <Trans i18nKey="connections.connections-redirect-notice.body">
            Data sources have a new home! You can discover new data sources or manage existing ones in the Connections
            page, accessible from the main menu.
          </Trans>
        </p>
        <LinkButton
          aria-label={t(
            'connections.connections-redirect-notice.aria-label-link-to-connections',
            'Link to Connections'
          )}
          icon="arrow-right"
          href={ROUTES.DataSources}
          fill="text"
        >
          <Trans i18nKey="connections.connections-redirect-notice.go-to-connections">Go to connections</Trans>
        </LinkButton>
      </div>
    </Alert>
  ) : (
    <></>
  );
}
