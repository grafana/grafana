import { css, cx } from '@emotion/css';
import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { useTheme2 } from '@grafana/ui';

import { DashboardStoryCanvas } from '../../utils/storybook/DashboardStoryCanvas';

import { UseSplitterOptions, useSplitter } from './useSplitter';
import mdx from './useSplitter.mdx';

const meta: Meta = {
  title: 'General/Layout/useSplitter',
  parameters: {
    docs: { page: mdx },
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

interface StoryOptions extends UseSplitterOptions {
  hasSecondPane: boolean;
}

export const Basic: StoryFn<StoryOptions> = (options) => {
  const theme = useTheme2();
  const paneStyles = css({
    background: theme.colors.background.primary,
    padding: theme.spacing(2),
    border: `1px solid ${theme.colors.border.weak}`,
  });

  const { containerProps, primaryProps, secondaryProps, splitterProps } = useSplitter({
    ...options,
  });

  if (!options.hasSecondPane) {
    primaryProps.style.flexGrow = 1;
  }

  return (
    <DashboardStoryCanvas>
      <div style={{ display: 'flex', width: '700px', height: '500px' }}>
        <div {...containerProps}>
          <div {...primaryProps} className={cx(primaryProps.className, paneStyles)}>
            Primary
          </div>
          {options.hasSecondPane && (
            <>
              <div {...splitterProps} />
              <div {...secondaryProps} className={cx(secondaryProps.className, paneStyles)}>
                Secondary
              </div>
            </>
          )}
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
