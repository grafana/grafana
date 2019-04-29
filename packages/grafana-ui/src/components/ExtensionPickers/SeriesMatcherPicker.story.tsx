import React, { PureComponent } from 'react';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { SeriesMatcherPicker } from './SeriesMatcherPicker';
import { text } from '@storybook/addon-knobs';
import { SeriesDataMatcherConfig } from '../../utils/index';

const getKnobs = () => {
  return {
    placeholder: text('Placeholder Text', ''),
    initialStats: text('Initial Stats', ''),
  };
};

interface State {
  stats: string[];
}

export class WrapperWithState extends PureComponent<any, State> {
  constructor(props: any) {
    super(props);
    this.state = {
      stats: [],
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
    const { placeholder } = this.props;
    const { stats } = this.state;

    return (
      <SeriesMatcherPicker
        placeholder={placeholder}
        onChange={(config: SeriesDataMatcherConfig) => {
          action('Picked:')(config);
          this.setState({ stats });
        }}
      />
    );
  }
}

const story = storiesOf('UI/SeriesMatcher', module);
story.addDecorator(withCenteredStory);
story.add('picker', () => {
  const { placeholder, initialStats } = getKnobs();

  return (
    <div>
      <WrapperWithState placeholder={placeholder} initialStats={initialStats} />
    </div>
  );
});
