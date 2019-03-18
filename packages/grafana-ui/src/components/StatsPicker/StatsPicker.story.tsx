import React, { PureComponent } from 'react';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { StatsPicker } from './StatsPicker';
import { text, boolean } from '@storybook/addon-knobs';

interface State {
  stats: string[];
}

export class WrapperWithState extends PureComponent<any, State> {
  constructor(props: any) {
    super(props);
    this.state = {
      stats: this.toStatsArray(props.initialReducers),
    };
  }

  toStatsArray = (txt: string): string[] => {
    return txt.split(',').map(v => v.trim());
  };

  componentDidUpdate(prevProps: any) {
    const { initialReducers } = this.props;
    if (initialReducers !== prevProps.initialReducers) {
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

const story = storiesOf('UI/TableReducePicker', module);
story.addDecorator(withCenteredStory);
story.add('picker', () => {
  const placeholder = text('Placeholder Text', '');
  const defaultStat = text('Default Stat', '');
  const allowMultiple = boolean('Allow Multiple', false);
  const initialStats = text('Initial Stats', '');
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
});
