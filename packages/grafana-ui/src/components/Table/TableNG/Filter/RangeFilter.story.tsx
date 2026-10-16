import { type Meta, type StoryObj } from '@storybook/react';
import { action } from 'storybook/actions';

import { FieldType, toDataFrame } from '@grafana/data';

import { compileFrameToRecords } from '../utils';

import { RangeFilter } from './RangeFilter';

const data = toDataFrame({
  fields: [{ name: 'Time', type: FieldType.time, values: [1789660800123, 1789747200999] }],
});

const meta: Meta<typeof RangeFilter> = {
  title: 'Date time pickers/Table date range filter',
  component: RangeFilter,
  decorators: [
    (Story) => (
      <div style={{ width: 'fit-content' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    field: data.fields[0],
    rows: compileFrameToRecords(['Time'])(data),
    range: { min: 1789660800123, max: 1789747200999, includeMissing: false },
    timeZone: 'America/New_York',
    onApply: action('Apply range'),
    onClear: action('Clear range'),
    onCancel: action('Cancel range'),
  },
};

export default meta;

export const DateBounds: StoryObj<typeof RangeFilter> = {};
