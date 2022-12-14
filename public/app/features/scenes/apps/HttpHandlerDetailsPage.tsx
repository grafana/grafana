// Libraries
import React from 'react';
import { useRouteMatch } from 'react-router-dom';

import { NavModelItem } from '@grafana/data';
import { Page } from 'app/core/components/Page/Page';

import { getTabs } from './GrafanaMonitoringApp';
import { getHandlerDetailsScene, getHandlerLogsScene } from './scenes';
import { getLinkUrlWithAppUrlState, useAppQueryParams } from './utils';

export function HttpHandlerDetailsPage() {
  const routeMatch = useRouteMatch<{ handler: string; tab: string }>();
  const handler = decodeURIComponent(routeMatch.params.handler);
  const metricsScene = getHandlerDetailsScene(handler);
  const logsScene = getHandlerLogsScene(handler);
  const parent = getTabs().find((x) => x.text === 'HTTP handlers')!;
  const params = useAppQueryParams();
  const baseUrl = `/scenes/grafana-monitoring/handlers/${encodeURIComponent(handler)}`;
  const tab = routeMatch.params.tab ?? 'metrics';

  const pageNav: NavModelItem = {
    text: metricsScene.state.title,
    url: getLinkUrlWithAppUrlState(baseUrl, params),
    parentItem: { text: parent.text, url: getLinkUrlWithAppUrlState(parent.url, params) },
    children: [],
  };

  pageNav.children!.push(
    {
      text: 'Metrics',
      active: tab === 'metrics',
      url: baseUrl,
      parentItem: pageNav,
    },
    {
      text: 'Logs',
      active: tab === 'logs',
      url: getLinkUrlWithAppUrlState(baseUrl + '/logs', params),
      parentItem: pageNav,
    }
  );

  return (
    <Page
      navId="grafana-monitoring"
      subTitle="A grafana http handler is responsible for service a specific API request"
      pageNav={pageNav}
      hideFooter={true}
    >
      <Page.Contents>
        {tab === 'logs' && <logsScene.Component model={logsScene} />}
        {tab === 'metrics' && <metricsScene.Component model={metricsScene} />}
      </Page.Contents>
    </Page>
  );
}
