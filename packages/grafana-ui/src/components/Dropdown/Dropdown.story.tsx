import { ComponentMeta } from '@storybook/react';
import React from 'react';

import { StoryExample } from '../../utils/storybook/StoryExample';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { Button, ButtonGroup } from '../Button';
import { VerticalGroup } from '../Layout/Layout';
import { Menu } from '../Menu/Menu';
import { MenuItem } from '../Menu/MenuItem';

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
      <MenuItem label="View settings" />
      <MenuItem label="Edit actions" />
      <MenuItem label="Share" />
      <MenuItem label="Delete" />
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
      <StoryExample name="Trigger hover">
        <ButtonGroup>
          <Button>Submit</Button>
          <Dropdown overlay={menu} placement="bottom-end" trigger={['hover']}>
            <Button icon="ellipsis-v" />
          </Dropdown>
        </ButtonGroup>
      </StoryExample>
    </VerticalGroup>
  );
}

export default meta;
