import { action } from 'storybook/actions';
import { useArgs } from 'storybook/preview-api';
import { type Meta, type StoryFn } from '@storybook/react-webpack5';

import { WeekStartPicker } from './WeekStartPicker';

const meta: Meta<typeof WeekStartPicker> = {
  title: 'Date time pickers/WeekStartPicker',
  component: WeekStartPicker,
  parameters: {
    controls: {
      exclude: ['onBlur', 'onChange', 'inputId'],
    },
  },
};

export const Basic: StoryFn<typeof WeekStartPicker> = (args) => {
  const [, updateArgs] = useArgs();
  return (
    <WeekStartPicker
      {...args}
      onChange={(newValue) => {
        action('onChange')(newValue);
        updateArgs({ value: newValue });
      }}
      onBlur={action('onBlur')}
    />
  );
};

export default meta;
