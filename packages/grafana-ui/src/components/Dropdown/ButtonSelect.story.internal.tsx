import React from 'react';
import { action } from '@storybook/addon-actions';
import { Story } from '@storybook/react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { UseState } from '../../utils/storybook/UseState';
import { SelectableValue } from '@grafana/data';
import { ButtonSelect } from './ButtonSelect';
import { DashboardStoryCanvas } from '../../utils/storybook/DashboardStoryCanvas';
import { NOOP_CONTROL } from '../../utils/storybook/noopControl';

export default {
  title: 'Forms/Select/ButtonSelect',
  component: ButtonSelect,
  decorators: [withCenteredStory],
  parameters: {
    knobs: {
      disable: true,
    },
  },
  argTypes: {
    className: NOOP_CONTROL,
    options: NOOP_CONTROL,
    value: NOOP_CONTROL,
    tooltipContent: NOOP_CONTROL,
  },
};

export const Basic: Story = (args) => {
  const initialValue: SelectableValue<string> = { label: 'A label', value: 'A value' };
  const options: Array<SelectableValue<string>> = [initialValue, { label: 'Another label', value: 'Another value' }];
  return (
    <DashboardStoryCanvas>
      <UseState initialState={initialValue}>
        {(value, updateValue) => {
          return (
            <div style={{ marginLeft: '100px', position: 'relative', display: 'inline-block' }}>
              <ButtonSelect
                {...args}
                value={value}
                options={options}
                onChange={(value) => {
                  action('onChanged fired')(value);
                  updateValue(value as any);
                }}
                className="refresh-select"
              />
            </div>
          );
        }}
      </UseState>
    </DashboardStoryCanvas>
  );
};
Basic.args = {
  narrow: true,
  variant: 'default',
};
