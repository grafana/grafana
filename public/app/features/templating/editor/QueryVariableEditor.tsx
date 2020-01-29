import React, { PureComponent } from 'react';

import { VariablePickerProps } from '../picker/VariablePicker';
import { QueryVariableState } from '../state/queryVariableReducer';

export interface Props extends VariablePickerProps {}

export class QueryVariableEditor extends PureComponent<Props, QueryVariableState> {
  render() {
    return <div>Editor</div>;
  }
}
