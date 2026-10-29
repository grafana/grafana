import { type Meta, type StoryFn } from '@storybook/react';
import { useState } from 'react';
import { action } from 'storybook/actions';
import { useArgs } from 'storybook/preview-api';

import { dateTime, DefaultTimeZone, isDateTime, type TimeRange } from '@grafana/data';

import { Button } from '../Button/Button';
import { Drawer } from '../Drawer/Drawer';

import { TimeRangeInput } from './TimeRangeInput';
import mdx from './TimeRangeInput.mdx';

const now = dateTime(Date.now());

const isOnRangeClear = (value: TimeRange) => {
  return (
    !value.from.isValid() &&
    !value.to.isValid() &&
    isDateTime(value.raw.from) &&
    !value.raw.from.isValid() &&
    isDateTime(value.raw.to) &&
    !value.raw.to.isValid()
  );
};

const nullRange = {
  from: null,
  to: null,
  raw: {
    from: null,
    to: null,
  },
};

const meta: Meta<typeof TimeRangeInput> = {
  title: 'Date time pickers/TimeRangeInput',
  component: TimeRangeInput,
  parameters: {
    controls: {
      exclude: ['onChange', 'onChangeTimeZone'],
    },
    docs: {
      page: mdx,
    },
  },
  args: {
    value: {
      from: now.subtract(6, 'h'),
      to: now,
      raw: {
        from: 'now-6h',
        to: 'now',
      },
    },
    timeZone: DefaultTimeZone,
  },
};

export const Basic: StoryFn<typeof TimeRangeInput> = (args) => {
  const [, updateArgs] = useArgs();
  return (
    <TimeRangeInput
      {...args}
      onChange={(value) => {
        action('onChange fired')(value);
        // Need some special logic to handle when the range is cleared since
        // storybook controls don't support null datetimes
        updateArgs({
          value: isOnRangeClear(value) ? nullRange : value,
        });
      }}
      onChangeTimeZone={(timeZone) => {
        action('onChangeTimeZone fired')(timeZone);
        updateArgs({
          timeZone,
        });
      }}
    />
  );
};

export const InsideDrawer: StoryFn<typeof TimeRangeInput> = (args) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="main-view">
      <Button onClick={() => setIsOpen(true)}>Open drawer</Button>
      {isOpen && (
        <Drawer title="Silence alert instance" size="md" onClose={() => setIsOpen(false)}>
          <div style={{ width: 400 }}>
            <TimeRangeInput {...args} />
          </div>
        </Drawer>
      )}
    </div>
  );
};

InsideDrawer.args = {
  hideQuickRanges: true,
  hideTimeZone: false,
};

export default meta;
