import { css, cx } from '@emotion/css';
import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { Button, useTheme2 } from '@grafana/ui';

import { DashboardStoryCanvas } from '../../utils/storybook/DashboardStoryCanvas';

import mdx from './Splitter.mdx';
import { UseSnappingSplitterOptions, useSnappingSplitter } from './useSnappingSpitter';

const meta: Meta = {
  title: 'General/Layout/useSnappingSpitter',
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
    direction: { control: { type: 'radio' }, options: ['row', 'column'] },
    dragPosition: { control: { type: 'radio' }, options: ['start', 'middle', 'end'] },
    hasSecondPane: { type: 'boolean', options: [true, false] },
  },
};

interface StoryOptions extends UseSnappingSplitterOptions {
  hasSecondPane: boolean;
}

export const Basic: StoryFn<StoryOptions> = (options) => {
  const theme = useTheme2();
  const paneStyles = css({
    display: 'flex',
    flexGrow: 1,
    background: theme.colors.background.primary,
    padding: theme.spacing(2),
    border: `1px solid ${theme.colors.border.weak}`,
    height: '100%',
  });

  const { containerProps, firstPaneProps, secondPaneProps, splitterProps, state } = useSnappingSplitter({
    ...options,
    paneOptions: {
      collapseBelowPixels: 150,
      snapOpenToPixels: 300,
    },
  });

  return (
    <DashboardStoryCanvas>
      <div style={{ display: 'flex', width: '700px', height: '500px' }}>
        <div {...containerProps}>
          <div {...firstPaneProps} className={cx(firstPaneProps.className, paneStyles)}>
            Primary
          </div>
          <div {...splitterProps} />
          <div {...secondPaneProps} className={cx(firstPaneProps.className, paneStyles)}>
            {state.collapsed && <Button onClick={() => {}} icon="angle-left" variant="secondary" />}
            {!state.collapsed && <div>Secondary pane open for business</div>}
          </div>
        </div>
      </div>
    </DashboardStoryCanvas>
  );
};

Basic.args = {
  direction: 'row',
  dragPosition: 'middle',
  hasSecondPane: true,
};

export default meta;
