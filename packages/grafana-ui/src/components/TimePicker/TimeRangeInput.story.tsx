import { Story } from '@storybook/react';
import React from 'react';
import { action } from '@storybook/addon-actions';
import { dateTime, DefaultTimeZone, TimeRange, TimeZone } from '@grafana/data';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { UseState } from '../../utils/storybook/UseState';
import { TimeRangeInput } from '@grafana/ui';
import { TimeRangeInputProps } from './TimeRangeInput';
import mdx from './TimeRangeInput.mdx';

export default {
  title: 'Pickers and Editors/TimePickers/TimeRangeInput',
  component: TimeRangeInput,
  decorators: [withCenteredStory],
  argTypes: {
    hideTimeZone: {
      control: 'boolean',
    },
    placeholder: {
      control: 'text',
    },
    clearable: {
      control: 'boolean',
    },
    isReversed: {
      control: 'boolean',
    },
    hideQuickRanges: {
      control: 'boolean',
    },
  },
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

const args = {
  hideTimeZone: false,
  placeholder: undefined,
  clearable: false,
  isReversed: true,
  hideQuickRanges: false,
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
          onChange={value => {
            action('onChange fired')(value);
            updateValue({
              ...state,
              value,
            });
          }}
          onChangeTimeZone={timeZone => {
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

export const Relative: Story<TimeRangeInputProps> = props => {
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

Relative.args = args;

export const Absolute: Story<TimeRangeInputProps> = props => {
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

Absolute.args = args;
