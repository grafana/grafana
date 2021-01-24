import { Story } from '@storybook/react';
import React from 'react';
import { action } from '@storybook/addon-actions';

import { Button, TimeRangePicker } from '@grafana/ui';
import { UseState } from '../../utils/storybook/UseState';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { dateTime, TimeRange, DefaultTimeZone, TimeZone, isDateTime } from '@grafana/data';
import { TimeRangePickerProps } from './TimeRangePicker';

export default {
  title: 'Pickers and Editors/TimePickers/TimeRangePicker',
  component: TimeRangePicker,
  decorators: [withCenteredStory],
};

interface State {
  value: TimeRange;
  timeZone: TimeZone;
  history: TimeRange[];
}

const getComponentWithState = (initialState: State, props: TimeRangePickerProps) => (
  <UseState initialState={initialState}>
    {(state, updateValue) => {
      return (
        <>
          <TimeRangePicker
            {...props}
            timeZone={state.timeZone}
            value={state.value}
            history={state.history}
            onChange={(value) => {
              action('onChange fired')(value);
              updateValue({
                ...state,
                value,
                history:
                  isDateTime(value.raw.from) && isDateTime(value.raw.to) ? [...state.history, value] : state.history,
              });
            }}
            onChangeTimeZone={(timeZone) => {
              action('onChangeTimeZone fired')(timeZone);
              updateValue({
                ...state,
                timeZone,
              });
            }}
            onMoveBackward={() => {
              action('onMoveBackward fired')();
            }}
            onMoveForward={() => {
              action('onMoveForward fired')();
            }}
            onZoom={() => {
              action('onZoom fired')();
            }}
          />
          <Button
            onClick={() => {
              updateValue({
                ...state,
                history: [],
              });
            }}
          >
            Clear history
          </Button>
        </>
      );
    }}
  </UseState>
);

export const Relative: Story<TimeRangePickerProps> = (props) => {
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
      history: [],
    },
    props
  );
};

export const Absolute: Story<TimeRangePickerProps> = (props) => {
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
      history: [],
    },
    props
  );
};
