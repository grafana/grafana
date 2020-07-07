import React, { ChangeEvent, PureComponent } from 'react';
import { TextBoxVariableModel } from '../types';
import { VariableEditorProps } from '../editor/types';

export interface Props extends VariableEditorProps<TextBoxVariableModel> {}
export class TextBoxVariableEditor extends PureComponent<Props> {
  onQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
    event.preventDefault();
    this.props.onPropChange({ propName: 'query', propValue: event.target.value, updateOptions: false });
  };
  onQueryBlur = (event: ChangeEvent<HTMLInputElement>) => {
    event.preventDefault();
    this.props.onPropChange({ propName: 'query', propValue: event.target.value, updateOptions: true });
  };
  render() {
    const { query } = this.props.variable;
    return (
      <div className="gf-form-group">
        <h5 className="section-heading">Text options</h5>
        <div className="gf-form">
          <span className="gf-form-label">Default value</span>
          <input
            type="text"
            className="gf-form-input"
            value={query}
            onChange={this.onQueryChange}
            onBlur={this.onQueryBlur}
            placeholder="default value, if any"
          />
        </div>
      </div>
    );
  }
}
