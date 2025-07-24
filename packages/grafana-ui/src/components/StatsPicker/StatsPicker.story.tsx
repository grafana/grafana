import { action } from '@storybook/addon-actions';
import { Meta, StoryFn } from '@storybook/react';
import { PureComponent } from 'react';

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
      <StatsPicker
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
    // TODO fix a11y issue in story and remove this
    a11y: { test: 'off' },
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
