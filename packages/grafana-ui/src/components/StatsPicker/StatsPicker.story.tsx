import { action } from 'storybook/actions';
import { type Meta, type StoryFn } from '@storybook/react-webpack5';
import { memo, useState } from 'react';

import { Field } from '../Forms/Field';

import { type StatsPickerProps, StatsPicker } from './StatsPicker';

const WrapperWithState = memo<StatsPickerProps>(({ placeholder, allowMultiple, width }) => {
  const [stats, setStats] = useState<string[]>([]);

  return (
    <Field label="Pick stats">
      <StatsPicker
        id="stats-picker"
        placeholder={placeholder}
        allowMultiple={allowMultiple}
        stats={stats}
        onChange={(newStats: string[]) => {
          action('Picked:')(newStats);
          setStats(newStats);
        }}
        width={width}
      />
    </Field>
  );
});

WrapperWithState.displayName = 'WrapperWithState';

const meta: Meta<typeof StatsPicker> = {
  title: 'Pickers/StatsPicker',
  component: StatsPicker,
  parameters: {
    controls: {
      exclude: ['onChange', 'stats', 'defaultStat'],
    },
  },
};

export const Picker: StoryFn<typeof StatsPicker> = (args) => {
  return (
    <div>
      <WrapperWithState {...args} />
    </div>
  );
};
Picker.args = {
  placeholder: 'placeholder',
  allowMultiple: false,
  width: 10,
};

export default meta;
