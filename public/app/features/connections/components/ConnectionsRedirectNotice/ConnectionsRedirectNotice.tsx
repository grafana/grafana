import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, LinkButton, useStyles2 } from '@grafana/ui';

import { ROUTES } from '../../constants';

const getStyles = (theme: GrafanaTheme2) => ({
  alertContent: css`
    display: flex;
    flex-direction: row;
    padding: 0;
    justify-content: space-between;
    align-items: center;
  `,
  alertParagraph: css`
    margin: 0 ${theme.spacing(1)} 0 0;
    line-height: ${theme.spacing(theme.components.height.sm)};
  `,
});

export function ConnectionsRedirectNotice() {
  const styles = useStyles2(getStyles);

  return (
    <Alert severity="warning" title="">
      <div className={styles.alertContent}>
        <p className={styles.alertParagraph}>
          Data sources have a new home! You can discover new data sources or manage existing ones in the new Connections
          page, accessible from the main menu.
        </p>
        <LinkButton aria-label="Link to Connections" icon="arrow-right" href={ROUTES.DataSources} fill="text">
          Go to connections
        </LinkButton>
      </div>
    </Alert>
  );
}
