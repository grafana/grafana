import React, { ChangeEvent, FocusEvent, PureComponent } from 'react';

import { DataSourceVariableModel, VariableWithMultiSupport } from '../../templating/types';
import { OnPropChangeArguments, VariableEditorProps } from '../editor/types';
import { SelectionOptionsEditor } from '../editor/SelectionOptionsEditor';
import { InlineFormLabel } from '@grafana/ui';
import { VariableEditorState } from '../editor/reducer';
import { DataSourceVariableEditorState } from './reducer';
import { initDataSourceVariableEditor } from './actions';
import { MapDispatchToProps, MapStateToProps } from 'react-redux';
import { StoreState } from '../../../types';
import { connectWithStore } from '../../../core/utils/connectWithReduxStore';
import { changeVariableMultiValue } from '../state/actions';

export interface OwnProps extends VariableEditorProps<DataSourceVariableModel> {}

interface ConnectedProps {
  editor: VariableEditorState<DataSourceVariableEditorState>;
}

interface DispatchProps {
  initDataSourceVariableEditor: typeof initDataSourceVariableEditor;
  changeVariableMultiValue: typeof changeVariableMultiValue;
}

type Props = OwnProps & ConnectedProps & DispatchProps;

export class DataSourceVariableEditorUnConnected extends PureComponent<Props> {
  async componentDidMount() {
    await this.props.initDataSourceVariableEditor();
  }

  onRegExChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.props.onPropChange({
      propName: 'regex',
      propValue: event.target.value,
    });
  };

  onRegExBlur = (event: FocusEvent<HTMLInputElement>) => {
    this.props.onPropChange({
      propName: 'regex',
      propValue: event.target.value,
      updateOptions: true,
    });
  };

  onSelectionOptionsChange = async ({ propValue, propName }: OnPropChangeArguments<VariableWithMultiSupport>) => {
    this.props.onPropChange({ propName, propValue, updateOptions: true });
  };

  getSelectedDataSourceTypeValue = (): string => {
    if (!this.props.editor.extended?.dataSourceTypes?.length) {
      return '';
    }
    const foundItem = this.props.editor.extended?.dataSourceTypes.find(ds => ds.value === this.props.variable.query);
    const value = foundItem ? foundItem.value : this.props.editor.extended?.dataSourceTypes[0].value;
    return value ?? '';
  };

  onDataSourceTypeChanged = (event: ChangeEvent<HTMLSelectElement>) => {
    this.props.onPropChange({ propName: 'query', propValue: event.target.value, updateOptions: true });
  };

  render() {
    return (
      <>
        <div className="gf-form-group">
          <h5 className="section-heading">Data source options</h5>

          <div className="gf-form">
            <label className="gf-form-label width-12">Type</label>
            <div className="gf-form-select-wrapper max-width-18">
              <select
                className="gf-form-input"
                value={this.getSelectedDataSourceTypeValue()}
                onChange={this.onDataSourceTypeChanged}
              >
                {this.props.editor.extended?.dataSourceTypes?.length &&
                  this.props.editor.extended?.dataSourceTypes?.map(ds => (
                    <option key={ds.value ?? ''} value={ds.value ?? ''} label={ds.text}>
                      {ds.text}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="gf-form">
            <InlineFormLabel
              width={12}
              tooltip={
                <div>
                  Regex filter for which data source instances to choose from in the variable value dropdown. Leave
                  empty for all.
                  <br />
                  <br />
                  Example: <code>/^prod/</code>
                </div>
              }
            >
              Instance name filter
            </InlineFormLabel>
            <input
              type="text"
              className="gf-form-input max-width-18"
              placeholder="/.*-(.*)-.*/"
              value={this.props.variable.regex}
              onChange={this.onRegExChange}
              onBlur={this.onRegExBlur}
            />
          </div>
        </div>

        <SelectionOptionsEditor
          variable={this.props.variable}
          onPropChange={this.onSelectionOptionsChange}
          onMultiChanged={this.props.changeVariableMultiValue}
        />
      </>
    );
  }
}

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = (state, ownProps) => ({
  editor: state.templating.editor as VariableEditorState<DataSourceVariableEditorState>,
});

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = {
  initDataSourceVariableEditor,
  changeVariableMultiValue,
};

export const DataSourceVariableEditor = connectWithStore(
  DataSourceVariableEditorUnConnected,
  mapStateToProps,
  mapDispatchToProps
);
