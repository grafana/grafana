// Libraries
import React from 'react';
import { useRouteMatch } from 'react-router-dom';

import { Page } from 'app/core/components/Page/Page';

import { getHandlerScene } from './state';

export function HttpHandlerScene() {
  const routeMatch = useRouteMatch<{ handler: string }>();
  const scene = getHandlerScene(decodeURIComponent(routeMatch.params.handler));

  const pageNav = {
    text: scene.state.title,
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
