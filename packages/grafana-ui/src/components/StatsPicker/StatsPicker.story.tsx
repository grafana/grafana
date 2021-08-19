import React, { PureComponent } from 'react';

import { action } from '@storybook/addon-actions';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { StatsPicker } from '@grafana/ui';
import { Meta, Story } from '@storybook/react';
import { Props } from './StatsPicker';

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

export default {
  title: 'Pickers and Editors/StatsPicker',
  component: StatsPicker,
  decorators: [withCenteredStory],
  parameters: {
    controls: {
      exclude: ['onChange', 'stats', 'defaultStat', 'className'],
    },
  },
} as Meta;

export const Picker: Story<Props> = (args) => {
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
