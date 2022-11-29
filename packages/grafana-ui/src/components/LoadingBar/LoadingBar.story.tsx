import { action } from '@storybook/addon-actions';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import React, { CSSProperties, useState, ReactNode } from 'react';

import { LoadingBar, LoadingBarProps } from '@grafana/ui';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

const meta: ComponentMeta<typeof LoadingBar> = {
  title: 'General/LoadingBar',
  component: LoadingBar,
  decorators: [withCenteredStory],
  parameters: {
    controls: {},
    docs: {},
  },
};

function getContentStyle(): CSSProperties {
  return {
    backgroundColor: '#181B1F',
    width: '400px',
    height: '200px',
    border: '1px solid rgba(204, 204, 220, 0.25)',
    borderRadius: '1px',
  };
}

export const Basic: ComponentStory<typeof LoadingBar> = (args: LoadingBarProps) => {
  const contentStyle = getContentStyle();

  return (
    <div style={contentStyle}>
      <LoadingBar {...args} />
    </div>
  );
};

Basic.args = {
  width: 128,
  height: 2,
  containerWidth: 400,
};

export default meta;
