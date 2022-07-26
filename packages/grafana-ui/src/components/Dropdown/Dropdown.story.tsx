import { ComponentMeta } from '@storybook/react';
import React from 'react';

import { StoryExample } from '../../utils/storybook/StoryExample';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { Button } from '../Button';
import { VerticalGroup } from '../Layout/Layout';
import { Menu } from '../Menu/Menu';

import { Dropdown } from './Dropdown';
import mdx from './Dropdown.mdx';

const meta: ComponentMeta<typeof Dropdown> = {
  title: 'Overlays/Dropdown',
  component: Dropdown,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['className'],
    },
  },
};

export function Examples() {
  const menu = (
    <Menu>
      <Menu.Item label="View settings" tabIndex={0} />
      <Menu.Item label="Edit actions" tabIndex={1} />
      <Menu.Item label="Share" tabIndex={2} />
      <Menu.Item label="Delete" tabIndex={3} />
    </Menu>
  );

  return (
    <VerticalGroup>
      <StoryExample name="Button + defaults">
        <Dropdown overlay={menu}>
          <Button variant="secondary">Button</Button>
        </Dropdown>
      </StoryExample>
      <StoryExample name="Icon button, placement=bottom-start">
        <Dropdown overlay={menu} placement="bottom-start">
          <Button variant="secondary" icon="bars" />
        </Dropdown>
      </StoryExample>
    </VerticalGroup>
  );
}

Examples.parameters = {
  controls: {
    hideNoControlsWarning: true,
    include: [],
  },
};

export default meta;
