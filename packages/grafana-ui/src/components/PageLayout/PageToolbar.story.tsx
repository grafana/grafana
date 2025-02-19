import { action } from '@storybook/addon-actions';
import { Meta } from '@storybook/react';

import { StoryExample } from '../../utils/storybook/StoryExample';
import { IconButton } from '../IconButton/IconButton';
import { Stack } from '../Layout/Stack/Stack';
import { ToolbarButton } from '../ToolbarButton';

import { PageToolbar } from './PageToolbar';

const meta: Meta<typeof PageToolbar> = {
  title: 'Layout/PageToolbar',
  component: PageToolbar,
  parameters: {},
};

export const Examples = () => {
  return (
    <Stack direction="column">
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
            <IconButton name="share-alt" size="lg" key="share" tooltip="Share" />,
            <IconButton name="favorite" iconType="mono" size="lg" key="favorite" tooltip="Add to favourites" />,
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
    </Stack>
  );
};

export default meta;
