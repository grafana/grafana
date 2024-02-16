import { css } from '@emotion/css';
import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { Splitter, useTheme2 } from '@grafana/ui';

import { DashboardStoryCanvas } from '../../utils/storybook/DashboardStoryCanvas';

import mdx from './Splitter.mdx';

const meta: Meta = {
  title: 'General/Layout/Splitter',
  component: Splitter,
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: [],
    },
  },
  argTypes: {
    initialSize: { control: { type: 'number', min: 0.1, max: 1 } },
  },
};

export const Basic: StoryFn = (args) => {
  const theme = useTheme2();
  const paneStyles = css({
    display: 'flex',
    flexGrow: 1,
    background: theme.colors.background.primary,
    padding: theme.spacing(2),
    border: `1px solid ${theme.colors.border.weak}`,
    height: '100%',
  });

  return (
    <DashboardStoryCanvas>
      <div style={{ display: 'flex', width: '700px', height: '500px' }}>
        <Splitter {...args}>
          <div className={paneStyles}>Primary</div>
          <div className={paneStyles}>Secondary</div>
        </Splitter>
      </div>
    </DashboardStoryCanvas>
  );
};

Basic.args = {
  direction: 'row',
  dragPosition: 'middle',
};

export default meta;
