import React, { PureComponent } from 'react';

import { VariableProps } from '../picker/VariablePicker';
import { QueryVariableState } from '../state/queryVariableReducer';

export interface Props extends VariableProps {}

export class QueryVariableEditor extends PureComponent<Props, QueryVariableState> {
  render() {
    return <div>Editor</div>;
  }
}
