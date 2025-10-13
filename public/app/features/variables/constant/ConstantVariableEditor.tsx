import { FormEvent, PureComponent } from 'react';

import { ConstantVariableModel } from '@grafana/data';
import { ConstantVariableForm } from 'app/features/dashboard-scene/settings/variables/components/ConstantVariableForm';

import { VariableEditorProps } from '../editor/types';

export interface Props extends VariableEditorProps<ConstantVariableModel> {}

export class ConstantVariableEditor extends PureComponent<Props> {
  onChange = (event: FormEvent<HTMLInputElement>) => {
    this.props.onPropChange({
      propName: 'query',
      propValue: event.currentTarget.value,
      updateOptions: true,
    });
  };

  render() {
    return <ConstantVariableForm constantValue={this.props.variable.query} onChange={this.onChange} />;
  }
}
