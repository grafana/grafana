import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { LinkButton, CallToActionCard, Icon, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';

function getCardStyles(theme: GrafanaTheme2) {
  return css({
    maxWidth: `${theme.breakpoints.values.lg}px`,
    marginTop: theme.spacing(2),
    alignSelf: 'center',
  });
}

export const NoDataSourceCallToAction = () => {
  const cardStyles = useStyles2(getCardStyles);

  const canCreateDataSource =
    contextSrv.hasPermission(AccessControlAction.DataSourcesCreate) &&
    contextSrv.hasPermission(AccessControlAction.DataSourcesWrite);

  const message =
    'Explore requires at least one data source. Once you have added a data source, you can query it here.';
  const footer = (
    <>
      <Icon name="rocket" />
      <> ProTip: You can also define data sources through configuration files. </>
      <a
        href="http://docs.grafana.org/administration/provisioning/?utm_source=explore#data-sources"
        target="_blank"
        rel="noreferrer"
        className="text-link"
      >
        Learn more
      </a>
    </>
  );

  const ctaElement = (
    <LinkButton size="lg" href="datasources/new" icon="database" disabled={!canCreateDataSource}>
      Add data source
    </LinkButton>
  );

  return <CallToActionCard callToActionElement={ctaElement} className={cardStyles} footer={footer} message={message} />;
};
