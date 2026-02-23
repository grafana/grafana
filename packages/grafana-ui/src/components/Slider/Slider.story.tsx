import { StoryFn, Meta } from '@storybook/react';
import { useId } from 'react';

import { Field } from '../Forms/Field';

import { Slider } from './Slider';

const meta: Meta<typeof Slider> = {
  title: 'Inputs/Slider',
  component: Slider,
  parameters: {
    controls: {
      exclude: ['formatTooltipResult', 'onChange', 'onAfterChange', 'value', 'tooltipAlwaysVisible'],
    },
    knobs: {
      disabled: true,
    },
  },
  argTypes: {
    orientation: { control: { type: 'select', options: ['horizontal', 'vertical'] } },
    step: { control: { type: 'number', min: 1 } },
  },
  args: {
    min: 0,
    max: 100,
    value: 10,
    orientation: 'horizontal',
    reverse: false,
    included: true,
    step: undefined,
  },
};

export const Basic: StoryFn<typeof Slider> = (args) => {
  const id = useId();

  return (
    <div style={{ width: '300px', height: '300px' }}>
      <Field label="Slider">
        <Slider {...args} inputId={id} />
      </Field>
    </div>
  );
};

export const WithMarks: StoryFn<typeof Slider> = (args) => {
  const id = useId();

  return (
    <div style={{ width: '300px', height: '300px' }}>
      <Field label="Slider">
        <Slider {...args} inputId={id} />
      </Field>
    </div>
  );
};
WithMarks.args = {
  marks: { 0: '0', 25: '25', 50: '50', 75: '75', 100: '100' },
};

export default meta;
