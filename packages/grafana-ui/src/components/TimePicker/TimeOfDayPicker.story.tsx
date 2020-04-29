import React from 'react';
import { action } from '@storybook/addon-actions';

import { TimeOfDayPicker } from './TimeOfDayPicker';
import { UseState } from '../../utils/storybook/UseState';
import { dateTime } from '@grafana/data';

export const basic = () => {
  return (
    <UseState
      initialState={{
        value: dateTime(Date.now()),
      }}
    >
      {(value, updateValue) => {
        return (
          <TimeOfDayPicker
            onChange={newValue => {
              action('on selected')(newValue);
              updateValue({ value: newValue });
            }}
            value={value.value}
          />
        );
      }}
    </UseState>
  );
};

export const onlyMinutes = () => {
  return (
    <UseState initialState={{ value: dateTime(Date.now()) }}>
      {(value, updateValue) => {
        return (
          <TimeOfDayPicker
            onChange={newValue => {
              action('on selected')(newValue);
              updateValue({ value: newValue });
            }}
            value={value.value}
            showHour={false}
          />
        );
      }}
    </UseState>
  );
};
