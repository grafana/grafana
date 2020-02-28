import React, { ChangeEvent, PureComponent } from 'react';
import { CustomVariableModel, VariableWithMultiSupport } from '../variable';
import { VariableEditorProps } from '../state/types';
import { CustomVariableEditorState } from './reducer';
import { SelectionOptionsEditor } from '../editor/SelectionOptionsEditor';
import { variableAdapters } from '../adapters';

export interface Props extends VariableEditorProps<CustomVariableModel, CustomVariableEditorState> {}
export interface State {
  query: string;
}

export class CustomVariableEditor extends PureComponent<Props, State> {
  runQuery = () => variableAdapters.get(this.props.variable.type).updateOptions(this.props.variable);

  onChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.props.onPropChange('query', event.target.value);
  };

  onSelectionOptionsChange = async (propName: keyof VariableWithMultiSupport, propValue: any) => {
    this.props.onPropChange(propName, propValue);
    this.runQuery();
  };

  render() {
    return (
      <>
        <div className="gf-form-group">
          <h5 className="section-heading">Custom Options</h5>
          <div className="gf-form">
            <span className="gf-form-label width-14">Values separated by comma</span>
            <input
              type="text"
              className="gf-form-input"
              value={this.props.variable.query}
              onChange={this.onChange}
              onBlur={this.runQuery}
              placeholder="1, 10, 20, myvalue, escaped\,value"
              required
              aria-label="Variable editor Form Custom Query field"
            />
          </div>
        </div>
        <SelectionOptionsEditor variable={this.props.variable} onPropChange={this.onSelectionOptionsChange} />
      </>
    );
  }
}
