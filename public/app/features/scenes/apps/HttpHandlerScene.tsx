// Libraries
import React from 'react';
import { useRouteMatch } from 'react-router-dom';

import { NavModelItem } from '@grafana/data';
import { Page } from 'app/core/components/Page/Page';

import { getTabs } from './GrafanaMonitoringApp';
import { getHandlerScene } from './state';

export function HttpHandlerScene() {
  const routeMatch = useRouteMatch<{ handler: string }>();
  const scene = getHandlerScene(decodeURIComponent(routeMatch.params.handler));
  const parent = getTabs().find((x) => x.text === 'HTTP handlers')!;

  const pageNav: NavModelItem = {
    text: scene.state.title,
    parentItem: { text: parent.text, url: parent.url },
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

export default HttpHandlerScene;
