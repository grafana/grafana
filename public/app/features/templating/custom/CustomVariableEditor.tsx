import React, { ChangeEvent, PureComponent } from 'react';
import { CustomVariableModel } from '../variable';
import { VariableEditorProps } from '../state/types';
import { CustomVariableEditorState } from './reducer';
import { dispatch } from '../../../store/store';
import { updateVariableQuery, toVariablePayload } from '../state/actions';

export interface Props extends VariableEditorProps<CustomVariableModel, CustomVariableEditorState> {}
export interface State {
  query: string;
}

export class CustomVariableEditor extends PureComponent<Props, State> {
  state: State = {
    query: '',
  };

  componentWillReceiveProps(nextProps: Readonly<Props>): void {
    if (nextProps.variable.query !== this.state.query) {
      this.setState({ query: nextProps.variable.query });
    }
  }

  runQuery = () => dispatch(updateVariableQuery(toVariablePayload(this.props.variable, this.state.query)));

  onChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({ query: event.target.value });
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
      </>
    );
  }
}
