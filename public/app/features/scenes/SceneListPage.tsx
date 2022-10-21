// Libraries
import React, { FC } from 'react';

import { Stack } from '@grafana/experimental';
import { Card } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

// Types
import { getScenes } from './scenes';

export interface Props {}

export const SceneListPage: FC<Props> = ({}) => {
  const scenes = getScenes();

  return (
    <Page navId="scenes">
      <Page.Contents>
        <Stack direction="column">
          {scenes.map((scene) => (
            <Card href={`/scenes/${scene.state.title}`} key={scene.state.title}>
              <Card.Heading>{scene.state.title}</Card.Heading>
            </Card>
          ))}
        </Stack>
      </Page.Contents>
    </Page>
  );
};

export default SceneListPage;
