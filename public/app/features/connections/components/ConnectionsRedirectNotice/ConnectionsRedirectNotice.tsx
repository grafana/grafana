import { css } from '@emotion/css';
import { useState } from 'react';

import type { GrafanaTheme2 } from '@grafana/data/themes';
import { Trans } from '@grafana/i18n';
import { Alert, TextLink } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/themes';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { ROUTES } from '../../constants';

const getStyles = (theme: GrafanaTheme2) => ({
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
      <p className={styles.alertParagraph}>
        <Trans
          i18nKey="connections.connections-redirect-notice.body"
          defaults="Data sources have a new home! You can discover new data sources or manage existing ones in the <0>Connections page</0>, accessible from the main menu."
          components={[
            <TextLink key="0" href={ROUTES.DataSources}>
              {''}
            </TextLink>,
          ]}
        />
      </p>
    </Alert>
  ) : (
    <></>
  );
}
