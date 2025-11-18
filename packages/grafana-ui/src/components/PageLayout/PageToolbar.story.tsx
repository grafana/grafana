import { action } from '@storybook/addon-actions';
import { Meta } from '@storybook/react';

import { IconButton } from '../IconButton/IconButton';
import { ToolbarButton } from '../ToolbarButton/ToolbarButton';

import { PageToolbar } from './PageToolbar';

const meta: Meta<typeof PageToolbar> = {
  title: 'Navigation/Deprecated/PageToolbar',
  component: PageToolbar,
};

export const WithNonClickableTitle = () => {
  return (
    <PageToolbar pageIcon="bell" title="Dashboard">
      <ToolbarButton icon="panel-add" tooltip="Add panel" />
      <ToolbarButton icon="sync">Sync</ToolbarButton>
    </PageToolbar>
  );
};

export const WithClickableTitleAndParent = () => {
  return (
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
      <ToolbarButton icon="panel-add" tooltip="Add panel" />
      <ToolbarButton icon="share-alt" tooltip="Share" />
      <ToolbarButton icon="sync">Sync</ToolbarButton>
      <ToolbarButton icon="cog">Settings </ToolbarButton>
    </PageToolbar>
  );
};

export const GoBackVersion = () => {
  return (
    <PageToolbar title="Service overview / Edit panel" onGoBack={() => action('Go back')}>
      <ToolbarButton icon="cog" tooltip="Settings" />
      <ToolbarButton icon="save" aria-label="Save" />
      <ToolbarButton>Discard</ToolbarButton>
      <ToolbarButton>Apply</ToolbarButton>
    </PageToolbar>
  );
};

export default meta;
