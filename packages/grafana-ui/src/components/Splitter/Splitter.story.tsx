import { css } from '@emotion/css';
import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { Spinner, useTheme2 } from '@grafana/ui';

import { DashboardStoryCanvas } from '../../utils/storybook/DashboardStoryCanvas';

import mdx from './Spinner.mdx';
import { Splitter } from './Splitter';

const meta: Meta = {
  title: 'General/Layout/Splitter',
  component: Spinner,
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: [],
    },
  },
  argTypes: {
    direction: { control: { type: 'radio' }, options: ['row', 'column'] },
  },
};

export const Basic: StoryFn = (args) => {
  const theme = useTheme2();
  const paneStyles = css({
    display: 'flex',
    flexGrow: 1,
    background: theme.colors.background.primary,
    height: '100%',
  });

  return (
    <DashboardStoryCanvas>
      <div style={{ display: 'flex', width: '900px', height: '700px' }}>
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
};

export default meta;
