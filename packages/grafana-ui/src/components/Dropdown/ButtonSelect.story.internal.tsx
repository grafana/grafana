import { action } from '@storybook/addon-actions';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';

import { SelectableValue } from '@grafana/data';

import { DashboardStoryCanvas } from '../../utils/storybook/DashboardStoryCanvas';
import { UseState } from '../../utils/storybook/UseState';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import { ButtonSelect } from './ButtonSelect';

const meta: ComponentMeta<typeof ButtonSelect> = {
  title: 'Forms/Select/ButtonSelect',
  component: ButtonSelect,
  decorators: [withCenteredStory],
  parameters: {
    controls: {
      exclude: ['className', 'options', 'value', 'tooltipContent'],
    },
  },
};

export const Basic: ComponentStory<typeof ButtonSelect> = (args) => {
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

export default meta;
