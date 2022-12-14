// Libraries
import React from 'react';
import { useRouteMatch } from 'react-router-dom';

import { NavModelItem } from '@grafana/data';
import { Page } from 'app/core/components/Page/Page';

import { getTabs } from './GrafanaMonitoringApp';
import { getHandlerDetailsScene } from './state';
import { getLinkUrlWithAppUrlState, useAppQueryParams } from './utils';

export function HttpHandlerDetailsPage() {
  const routeMatch = useRouteMatch<{ handler: string }>();
  const scene = getHandlerDetailsScene(decodeURIComponent(routeMatch.params.handler));
  const parent = getTabs().find((x) => x.text === 'HTTP handlers')!;
  const params = useAppQueryParams();

  const pageNav: NavModelItem = {
    text: scene.state.title,
    parentItem: { text: parent.text, url: getLinkUrlWithAppUrlState(parent.url, params) },
  };

  return (
    <Page
      navId="grafana-monitoring"
      subTitle="A grafana http handler is responsible for service a specific API request"
      pageNav={pageNav}
    >
      <Page.Contents>
        <scene.Component model={scene} />
      </Page.Contents>
    </Page>
  );
}
