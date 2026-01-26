import { action } from '@storybook/addon-actions';
import { Meta, StoryFn } from '@storybook/react';
import { memo, useState } from 'react';

import { Field } from '../Forms/Field';

import { Props, StatsPicker } from './StatsPicker';

const WrapperWithState = memo<Props>(({ placeholder, allowMultiple, menuPlacement, width }) => {
  const [stats, setStats] = useState<string[]>([]);

  return (
    <Field label="Pick stats">
      <StatsPicker
        inputId="stats-picker"
        placeholder={placeholder}
        allowMultiple={allowMultiple}
        stats={stats}
        onChange={(newStats: string[]) => {
          action('Picked:')(newStats);
          setStats(newStats);
        }}
        menuPlacement={menuPlacement}
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
      exclude: ['onChange', 'stats', 'defaultStat', 'className'],
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
  menuPlacement: 'auto',
  width: 10,
};

export default meta;
