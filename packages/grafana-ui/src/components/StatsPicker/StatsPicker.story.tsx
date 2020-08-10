import React, { PureComponent } from 'react';

import { action } from '@storybook/addon-actions';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { StatsPicker } from '@grafana/ui';
import { text, boolean } from '@storybook/addon-knobs';

const getKnobs = () => {
  return {
    placeholder: text('Placeholder Text', ''),
    defaultStat: text('Default Stat', ''),
    allowMultiple: boolean('Allow Multiple', false),
    initialStats: text('Initial Stats', ''),
  };
};

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
    return txt.split(',').map(v => v.trim());
  };

  componentDidUpdate(prevProps: any) {
    const { initialReducers } = this.props;
    if (initialReducers !== prevProps.initialReducers) {
      console.log('Changing initial reducers');
      this.setState({ stats: this.toStatsArray(initialReducers) });
    }
  }

  render() {
    const { placeholder, defaultStat, allowMultiple } = this.props;
    const { stats } = this.state;

    return (
      <StatsPicker
        placeholder={placeholder}
        defaultStat={defaultStat}
        allowMultiple={allowMultiple}
        stats={stats}
        onChange={(stats: string[]) => {
          action('Picked:')(stats);
          this.setState({ stats });
        }}
      />
    );
  }
}

export default {
  title: 'Pickers and Editors/StatsPicker',
  component: StatsPicker,
  decorators: [withCenteredStory],
};

export const picker = () => {
  const { placeholder, defaultStat, allowMultiple, initialStats } = getKnobs();

  return (
    <div>
      <WrapperWithState
        placeholder={placeholder}
        defaultStat={defaultStat}
        allowMultiple={allowMultiple}
        initialStats={initialStats}
      />
    </div>
  );
};
