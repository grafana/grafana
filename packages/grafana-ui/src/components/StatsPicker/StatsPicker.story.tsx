import { action } from '@storybook/addon-actions';
import { Meta, StoryFn } from '@storybook/react';
import { PureComponent } from 'react';

import { Field } from '../Forms/Field';

import { Props, StatsPicker } from './StatsPicker';

interface State {
  stats: string[];
}

class WrapperWithState extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      stats: [],
    };
  }

  render() {
    const { placeholder, allowMultiple, menuPlacement, width } = this.props;
    const { stats } = this.state;

    return (
      <Field label="Pick stats">
        <StatsPicker
          inputId="stats-picker"
          placeholder={placeholder}
          allowMultiple={allowMultiple}
          stats={stats}
          onChange={(stats: string[]) => {
            action('Picked:')(stats);
            this.setState({ stats });
          }}
          menuPlacement={menuPlacement}
          width={width}
        />
      </Field>
    );
  }
}

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
