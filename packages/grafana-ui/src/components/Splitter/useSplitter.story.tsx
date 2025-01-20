import { Meta, StoryFn } from '@storybook/react';

import { DashboardStoryCanvas } from '../../utils/storybook/DashboardStoryCanvas';
import { Box } from '../Layout/Box/Box';

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
          <div {...primaryProps}>
            <Box display="flex" grow={1} backgroundColor="primary" padding={2}>
              Primary
            </Box>
          </div>
          {options.hasSecondPane && (
            <>
              <div {...splitterProps} />
              <div {...secondaryProps}>
                <Box display="flex" grow={1} backgroundColor="primary" padding={2}>
                  Secondary
                </Box>
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
