// Libraries
import React, { FC } from 'react';

import { NavModelItem } from '@grafana/data';
import { Page } from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { getSceneByTitle } from './scenes';

export interface Props extends GrafanaRouteComponentProps<{ name: string }> {}

export const SceneEmbeddedPage: FC<Props> = (props) => {
  const scene = getSceneByTitle(props.match.params.name, false);

  if (!scene) {
    return <h2>Scene not found</h2>;
  }

  const pageNav: NavModelItem = {
    text: scene.state.title,
  };
  return (
    <Page navId="scenes" pageNav={pageNav}>
      <Page.Contents>
        <scene.Component model={scene} />
      </Page.Contents>
    </Page>
  );
};

export default SceneEmbeddedPage;
