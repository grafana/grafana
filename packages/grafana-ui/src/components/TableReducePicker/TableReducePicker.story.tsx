import React, { PureComponent } from 'react';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { TableReducePicker } from './TableReducePicker';

interface State {
  reducers: string[];
}

export class WrapperWithState extends PureComponent<any, State> {
  constructor(props: any) {
    super(props);
    this.state = {
      reducers: [], // nothing?
    };
  }

  render() {
    return (
      <TableReducePicker
        {...this.props}
        reducers={this.state.reducers}
        onChange={(reducers: string[]) => {
          action('Reduce')(reducers);
          this.setState({ reducers });
        }}
      />
    );
  }
}

const story = storiesOf('UI/TableReducePicker', module);
story.addDecorator(withCenteredStory);
story.add('default', () => {
  return (
    <div>
      <WrapperWithState />
    </div>
  );
});
