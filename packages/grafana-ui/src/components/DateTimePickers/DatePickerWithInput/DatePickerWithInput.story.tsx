import { action } from '@storybook/addon-actions';
import { useArgs } from '@storybook/client-api';
import { ComponentStory, ComponentMeta } from '@storybook/react';
import React from 'react';

import { withCenteredStory } from '../../../utils/storybook/withCenteredStory';

import { DatePickerWithInput } from './DatePickerWithInput';
import mdx from './DatePickerWithInput.mdx';

const today = new Date();

// minimum date is initially set to 1 month before to allow the user
// to quickly see its effects
const minimumDate = new Date();
minimumDate.setMonth(minimumDate.getMonth() - 1);

const meta: ComponentMeta<typeof DatePickerWithInput> = {
  title: 'Pickers and Editors/TimePickers/DatePickerWithInput',
  component: DatePickerWithInput,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['value', 'onChange', 'prefix', 'suffix', 'width', 'invalid', 'loading', 'addonBefore', 'addonAfter'],
    },
  },
  args: {
    value: today,
    minDate: minimumDate,
    closeOnSelect: true,
    placeholder: 'Date',
  },
  argTypes: {
    minDate: { control: 'date' },
  },
};

export const Basic: ComponentStory<typeof DatePickerWithInput> = (args) => {
  const [, updateArgs] = useArgs();

  // the minDate arg can change from Date object to number, we need to handle this
  // scenario to avoid a crash in the component's story.
  const minDateVal = typeof args.minDate === 'number' ? new Date(args.minDate) : args.minDate;

  return (
    <DatePickerWithInput
      {...args}
      width={40}
      minDate={minDateVal}
      onChange={(newValue) => {
        action('on selected')(newValue);
        updateArgs({ value: newValue });
      }}
    />
  );
};

export default meta;
