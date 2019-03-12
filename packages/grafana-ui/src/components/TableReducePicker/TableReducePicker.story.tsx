import React, { PureComponent } from 'react';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { TableReducePicker } from './TableReducePicker';
import { text, boolean } from '@storybook/addon-knobs';

interface State {
  reducers: string[];
}

export class WrapperWithState extends PureComponent<any, State> {
  constructor(props: any) {
    super(props);
    this.state = {
      reducers: this.toReducersArray(props.initialReducers),
    };
  }

  toReducersArray = (txt: string): string[] => {
    return txt.split(',').map(v => v.trim());
  };

  componentDidUpdate(prevProps: any) {
    const { initialReducers } = this.props;
    if (initialReducers !== prevProps.initialReducers) {
      this.setState({ reducers: this.toReducersArray(initialReducers) });
    }
  }

  render() {
    const { placeholder, defaultReducer, allowMultiple } = this.props;
    const { reducers } = this.state;

    return (
      <TableReducePicker
        placeholder={placeholder}
        defaultReducer={defaultReducer}
        allowMultiple={allowMultiple}
        reducers={reducers}
        onChange={(reducers: string[]) => {
          action('Picked:')(reducers);
          this.setState({ reducers });
        }}
      />
    );
  }
}

const story = storiesOf('UI/TableReducePicker', module);
story.addDecorator(withCenteredStory);
story.add('picker', () => {
  const placeholder = text('Placeholder Text', '');
  const defaultReducer = text('Default Reducer', '');
  const allowMultiple = boolean('Allow Multiple', false);
  const initialReducers = text('Initial Reducers', '');
  return (
    <div>
      <WrapperWithState
        placeholder={placeholder}
        defaultReducer={defaultReducer}
        allowMultiple={allowMultiple}
        initialReducers={initialReducers}
      />
    </div>
  );
});
