import React, { PureComponent } from 'react';
import Forms from '../../Forms';

interface Props {}
interface State {}

export default class TimeRangeForm extends PureComponent<Props, State> {
  state: State = {};

  render() {
    return (
      <>
        <Forms.Field label="From">
          <Forms.Input id="time-picker-from" />
        </Forms.Field>
        <Forms.Field label="To">
          <Forms.Input id="time-picker-to" />
        </Forms.Field>
        <Forms.Button>Apply time interval</Forms.Button>
      </>
    );
  }
}
