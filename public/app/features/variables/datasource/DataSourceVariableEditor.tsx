import React, { ChangeEvent, FocusEvent, PureComponent } from 'react';
import { MapDispatchToProps, MapStateToProps } from 'react-redux';
import { InlineFieldRow, VerticalGroup } from '@grafana/ui';

import { DataSourceVariableModel, VariableWithMultiSupport } from '../types';
import { OnPropChangeArguments, VariableEditorProps } from '../editor/types';
import { SelectionOptionsEditor } from '../editor/SelectionOptionsEditor';
import { VariableEditorState } from '../editor/reducer';
import { DataSourceVariableEditorState } from './reducer';
import { initDataSourceVariableEditor } from './actions';
import { StoreState } from '../../../types';
import { connectWithStore } from '../../../core/utils/connectWithReduxStore';
import { changeVariableMultiValue } from '../state/actions';
import { VariableSectionHeader } from '../editor/VariableSectionHeader';
import { VariableSelectField } from '../editor/VariableSelectField';
import { SelectableValue } from '@grafana/data';
import { VariableTextField } from '../editor/VariableTextField';

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
  componentDidMount() {
    this.props.initDataSourceVariableEditor();
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
    const foundItem = this.props.editor.extended?.dataSourceTypes.find((ds) => ds.value === this.props.variable.query);
    const value = foundItem ? foundItem.value : this.props.editor.extended?.dataSourceTypes[0].value;
    return value ?? '';
  };

  onDataSourceTypeChanged = (option: SelectableValue<string>) => {
    this.props.onPropChange({ propName: 'query', propValue: option.value, updateOptions: true });
  };

  render() {
    const typeOptions = this.props.editor.extended?.dataSourceTypes?.length
      ? this.props.editor.extended?.dataSourceTypes?.map((ds) => ({ value: ds.value ?? '', label: ds.text }))
      : [];
    const typeValue = typeOptions.find((o) => o.value === this.props.variable.query) ?? typeOptions[0];

    return (
      <VerticalGroup spacing="xs">
        <VariableSectionHeader name="Data source options" />
        <VerticalGroup spacing="md">
          <VerticalGroup spacing="xs">
            <InlineFieldRow>
              <VariableSelectField
                name="Type"
                value={typeValue}
                options={typeOptions}
                onChange={this.onDataSourceTypeChanged}
                labelWidth={10}
              />
            </InlineFieldRow>
            <InlineFieldRow>
              <VariableTextField
                value={this.props.variable.regex}
                name="Instance name filter"
                placeholder="/.*-(.*)-.*/"
                onChange={this.onRegExChange}
                onBlur={this.onRegExBlur}
                labelWidth={20}
                tooltip={
                  <div>
                    Regex filter for which data source instances to choose from in the variable value dropdown. Leave
                    empty for all.
                    <br />
                    <br />
                    Example: <code>/^prod/</code>
                  </div>
                }
              />
            </InlineFieldRow>
          </VerticalGroup>

          <SelectionOptionsEditor
            variable={this.props.variable}
            onPropChange={this.onSelectionOptionsChange}
            onMultiChanged={this.props.changeVariableMultiValue}
          />
        </VerticalGroup>
      </VerticalGroup>
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
