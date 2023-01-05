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
  `,
  alertParagraph: css`
    margin: 0 ${theme.spacing(1)} 0 0;
    line-height: ${theme.spacing(theme.components.height.md)};
    color: ${theme.colors.text.primary};
  `,
});

export enum DestinationPage {
  dataSources = 'dataSources',
  connectData = 'connectData',
}

const destinationLinks = {
  [DestinationPage.dataSources]: ROUTES.DataSources,
  [DestinationPage.connectData]: ROUTES.ConnectData,
};

export function ConnectionsRedirectNotice({ destinationPage }: { destinationPage: DestinationPage }) {
  const styles = useStyles2(getStyles);

  return (
    <Alert severity="warning" title="Data sources have a new home!">
      <div className={styles.alertContent}>
        <p className={styles.alertParagraph}>
          You can discover new data sources or manage existing ones in the new Connections section, accessible from the
          left-hand navigation, or click the button here.
        </p>
        <LinkButton aria-label="Link to Connections" icon="link" href={destinationLinks[destinationPage]}>
          Connections
        </LinkButton>
      </div>
    </Alert>
  );
}
