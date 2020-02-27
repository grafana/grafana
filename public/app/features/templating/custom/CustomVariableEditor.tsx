import React, { ChangeEvent, PureComponent } from 'react';
import { CustomVariableModel, VariableWithMultiSupport } from '../variable';
import { VariableEditorProps } from '../state/types';
import { CustomVariableEditorState } from './reducer';
import { dispatch } from '../../../store/store';
import { updateVariableQuery, toVariablePayload } from '../state/actions';
import { SelectionOptionsEditor } from '../editor/SelectionOptionsEditor';

export interface Props extends VariableEditorProps<CustomVariableModel, CustomVariableEditorState> {}
export interface State {
  query: string;
}

export class CustomVariableEditor extends PureComponent<Props, State> {
  state: State = {
    query: this.props.variable.query,
  };

  runQuery = () => dispatch(updateVariableQuery(toVariablePayload(this.props.variable, this.state.query)));

  onChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({ query: event.target.value });
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
              value={this.state.query}
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
