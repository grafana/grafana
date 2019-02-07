import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { TimePicker } from './TimePicker';

const TimePickerStories = storiesOf('UI/TimePicker', module);

TimePickerStories.addDecorator(withCenteredStory);

TimePickerStories.add('default', () => {
  return (
    <TimePicker
      displayValue={'Today'}
      value={{ from: 'now/d', to: 'now/d' }}
      selectTimeOptions={[
        { from: 'now-5m', to: 'now', display: 'Last 5 minutes', section: 3, active: false },
        { from: 'now-15m', to: 'now', display: 'Last 15 minutes', section: 3, active: false },
        { from: 'now-30m', to: 'now', display: 'Last 30 minutes', section: 3, active: false },
        { from: 'now-1h', to: 'now', display: 'Last 1 hour', section: 3, active: false },
        { from: 'now-3h', to: 'now', display: 'Last 3 hours', section: 3, active: false },
        { from: 'now-6h', to: 'now', display: 'Last 6 hours', section: 3, active: false },
        { from: 'now-12h', to: 'now', display: 'Last 12 hours', section: 3, active: false },
        { from: 'now-24h', to: 'now', display: 'Last 24 hours', section: 3, active: false },
      ]}
      onChange={timeOption => {
        action('onChange fired')(timeOption);
      }}
    />
  );
});
