import React, { PureComponent } from 'react';
import { QueryVariableState } from '../state/queryVariableReducer';

export interface Props extends QueryVariableState {}

export class QueryVariableEditor extends PureComponent<Props> {
  render() {
    return <div>Editor</div>;
  }
}
