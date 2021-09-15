import React from 'react';
import { ToolbarButton, VerticalGroup } from '@grafana/ui';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { PageToolbar } from './PageToolbar';
import { StoryExample } from '../../utils/storybook/StoryExample';
import { action } from '@storybook/addon-actions';
import { IconButton } from '../IconButton/IconButton';

export default {
  title: 'Layout/PageToolbar',
  component: PageToolbar,
  decorators: [withCenteredStory],
  parameters: {},
};

export const Examples = () => {
  return (
    <VerticalGroup>
      <StoryExample name="With non clickable title">
        <PageToolbar pageIcon="bell" title="Dashboard">
          <ToolbarButton icon="panel-add" />
          <ToolbarButton icon="sync">Sync</ToolbarButton>
        </PageToolbar>
      </StoryExample>
      <StoryExample name="With clickable title and parent">
        <PageToolbar
          pageIcon="apps"
          title="A very long dashboard name"
          parent="A long folder name"
          titleHref=""
          parentHref=""
          leftItems={[
            <IconButton name="share-alt" size="lg" key="share" />,
            <IconButton name="favorite" iconType="mono" size="lg" key="favorite" />,
          ]}
        >
          <ToolbarButton icon="panel-add" />
          <ToolbarButton icon="share-alt" />
          <ToolbarButton icon="sync">Sync</ToolbarButton>
          <ToolbarButton icon="cog">Settings </ToolbarButton>
        </PageToolbar>
      </StoryExample>
      <StoryExample name="Go back version">
        <PageToolbar title="Service overview / Edit panel" onGoBack={() => action('Go back')}>
          <ToolbarButton icon="cog" />
          <ToolbarButton icon="save" />
          <ToolbarButton>Discard</ToolbarButton>
          <ToolbarButton>Apply</ToolbarButton>
        </PageToolbar>
      </StoryExample>
    </VerticalGroup>
  );
};
