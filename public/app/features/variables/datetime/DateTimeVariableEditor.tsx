import { PureComponent } from 'react';

import { DateTimeVariableModel } from '../types';
import { VariableEditorProps } from '../editor/types';

export interface Props extends VariableEditorProps<DateTimeVariableModel> {}

export class DateTimeVariableEditor extends PureComponent<Props> {
  render() {
    return null;
  }
}
