import React from 'react';
import { Story, Meta } from '@storybook/react';
import { PanelMenu } from './PanelMenu';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

export default {
  title: 'PanelMenu',
  component: PanelMenu,
  decorators: [withCenteredStory],
} as Meta;

export const Basic: Story = () => {
  return (
    <PanelMenu
      title="My cool panel"
      items={[
        { text: 'View', iconClassName: 'eye', shortcut: 'v' },
        { text: 'Edit', iconClassName: 'edit', shortcut: 'e' },
        { text: 'Share', iconClassName: 'share-alt', shortcut: 'p s' },
        { text: 'Explore', iconClassName: 'compass', shortcut: 'x' },
        {
          text: 'Inspect',
          iconClassName: 'info-circle',
          shortcut: 'i',
          subMenu: [{ text: 'Data' }, { text: 'Query' }, { text: 'Panel JSON' }],
        },
        {
          text: 'More...',
          iconClassName: 'cube',
          subMenu: [{ text: 'Duplicate', shortcut: 'p d' }, { text: 'Copy' }, { text: 'Create library panel' }],
        },
        { type: 'divider', text: '' },
        { text: 'Remove', shortcut: 'p r' },
      ]}
    />
  );
};
