import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';

import { Label } from './Label';
import mdx from './Label.mdx';

const meta: ComponentMeta<typeof Label> = {
  title: 'Forms/Label',
  component: Label,
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const simple: ComponentStory<typeof Label> = () => {
  return <Label description="Option description">Option name</Label>;
};

export const categorised: ComponentStory<typeof Label> = () => {
  return (
    <Label category={['Category', 'Nested category']} description="Option description">
      Option name
    </Label>
  );
};

export default meta;
