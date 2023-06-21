import { action } from '@storybook/addon-actions';
import { Meta, StoryFn } from '@storybook/react';
import React, { PureComponent } from 'react';

import { StatsPicker } from '@grafana/ui';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

interface State {
  stats: string[];
}

class WrapperWithState extends PureComponent<any, State> {
  constructor(props: any) {
    super(props);
    this.state = {
      stats: this.toStatsArray(props.initialReducers),
    };
  }

  toStatsArray = (txt: string): string[] => {
    if (!txt) {
      return [];
    }
    return txt.split(',').map((v) => v.trim());
  };

  componentDidUpdate(prevProps: any) {
    const { initialReducers } = this.props;
    if (initialReducers !== prevProps.initialReducers) {
      console.log('Changing initial reducers');
      this.setState({ stats: this.toStatsArray(initialReducers) });
    }
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
  title: 'Pickers and Editors/StatsPicker',
  component: StatsPicker,
  decorators: [withCenteredStory],
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
