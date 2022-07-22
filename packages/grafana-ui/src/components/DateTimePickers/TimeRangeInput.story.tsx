import { action } from '@storybook/addon-actions';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';

import { dateTime, DefaultTimeZone, TimeRange, TimeZone } from '@grafana/data';
import { TimeRangeInput } from '@grafana/ui';

import { UseState } from '../../utils/storybook/UseState';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import { TimeRangeInputProps } from './TimeRangeInput';
import mdx from './TimeRangeInput.mdx';

const meta: ComponentMeta<typeof TimeRangeInput> = {
  title: 'Pickers and Editors/TimePickers/TimeRangeInput',
  component: TimeRangeInput,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

interface State {
  value: TimeRange;
  timeZone: TimeZone;
}

const getComponentWithState = (initialState: State, props: TimeRangeInputProps) => (
  <UseState initialState={initialState}>
    {(state, updateValue) => {
      return (
        <TimeRangeInput
          {...props}
          value={state.value}
          timeZone={state.timeZone}
          onChange={(value) => {
            action('onChange fired')(value);
            updateValue({
              ...state,
              value,
            });
          }}
          onChangeTimeZone={(timeZone) => {
            action('onChangeTimeZone fired')(timeZone);
            updateValue({
              ...state,
              timeZone,
            });
          }}
        />
      );
    }}
  </UseState>
);

export const Relative: ComponentStory<typeof TimeRangeInput> = (props) => {
  const to = dateTime();
  const from = to.subtract(6, 'h');

  return getComponentWithState(
    {
      value: {
        from,
        to,
        raw: {
          from: 'now-6h',
          to: 'now',
        },
      },
      timeZone: DefaultTimeZone,
    },
    props
  );
};

export const Absolute: ComponentStory<typeof TimeRangeInput> = (props) => {
  const to = dateTime();
  const from = to.subtract(6, 'h');

  return getComponentWithState(
    {
      value: {
        from,
        to,
        raw: {
          from,
          to,
        },
      },
      timeZone: DefaultTimeZone,
    },
    props
  );
};

export default meta;
