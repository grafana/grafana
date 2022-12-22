import React, { FormEvent, PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { StoreState } from '../../../types';
import { SelectionOptionsEditor } from '../editor/SelectionOptionsEditor';
import { VariableLegend } from '../editor/VariableLegend';
import { VariableSelectField } from '../editor/VariableSelectField';
import { VariableTextField } from '../editor/VariableTextField';
import { initialVariableEditorState } from '../editor/reducer';
import { getDatasourceVariableEditorState } from '../editor/selectors';
import { OnPropChangeArguments, VariableEditorProps } from '../editor/types';
import { changeVariableMultiValue } from '../state/actions';
import { getVariablesState } from '../state/selectors';
import { DataSourceVariableModel, VariableWithMultiSupport } from '../types';

import { initDataSourceVariableEditor } from './actions';

const mapStateToProps = (state: StoreState, ownProps: OwnProps) => {
  const {
    variable: { rootStateKey },
  } = ownProps;
  if (!rootStateKey) {
    console.error('DataSourceVariableEditor: variable has no rootStateKey');
    return {
      extended: getDatasourceVariableEditorState(initialVariableEditorState),
    };
  }

  const { editor } = getVariablesState(rootStateKey, state);
  return {
    extended: getDatasourceVariableEditorState(editor),
  };
};

const mapDispatchToProps = {
  initDataSourceVariableEditor,
  changeVariableMultiValue,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export interface OwnProps extends VariableEditorProps<DataSourceVariableModel> {}

type Props = OwnProps & ConnectedProps<typeof connector>;

export class DataSourceVariableEditorUnConnected extends PureComponent<Props> {
  componentDidMount() {
    const { rootStateKey } = this.props.variable;
    if (!rootStateKey) {
      console.error('DataSourceVariableEditor: variable has no rootStateKey');
      return;
    }

    this.props.initDataSourceVariableEditor(rootStateKey);
  }

  onRegExChange = (event: FormEvent<HTMLInputElement>) => {
    this.props.onPropChange({
      propName: 'regex',
      propValue: event.currentTarget.value,
    });
  };

  onRegExBlur = (event: FormEvent<HTMLInputElement>) => {
    this.props.onPropChange({
      propName: 'regex',
      propValue: event.currentTarget.value,
      updateOptions: true,
    });
  };

  onSelectionOptionsChange = async ({ propValue, propName }: OnPropChangeArguments<VariableWithMultiSupport>) => {
    this.props.onPropChange({ propName, propValue, updateOptions: true });
  };

  getSelectedDataSourceTypeValue = (): string => {
    const { extended } = this.props;

    if (!extended?.dataSourceTypes.length) {
      return '';
    }

    const foundItem = extended.dataSourceTypes.find((ds) => ds.value === this.props.variable.query);
    const value = foundItem ? foundItem.value : extended.dataSourceTypes[0].value;
    return value ?? '';
  };

  onDataSourceTypeChanged = (option: SelectableValue<string>) => {
    this.props.onPropChange({ propName: 'query', propValue: option.value, updateOptions: true });
  };

  render() {
    const { variable, extended, changeVariableMultiValue } = this.props;

    const typeOptions = extended?.dataSourceTypes?.length
      ? extended.dataSourceTypes?.map((ds) => ({ value: ds.value ?? '', label: ds.text }))
      : [];

    const typeValue = typeOptions.find((o) => o.value === variable.query) ?? typeOptions[0];

    return (
      <>
        <VariableLegend>Data source options</VariableLegend>
        <VariableSelectField
          name="Type"
          value={typeValue}
          options={typeOptions}
          onChange={this.onDataSourceTypeChanged}
          testId={selectors.pages.Dashboard.Settings.Variables.Edit.DatasourceVariable.datasourceSelect}
        />

        <VariableTextField
          value={this.props.variable.regex}
          name="Instance name filter"
          placeholder="/.*-(.*)-.*/"
          onChange={this.onRegExChange}
          onBlur={this.onRegExBlur}
          description={
            <div>
              Regex filter for which data source instances to choose from in the variable value list. Leave empty for
              all.
              <br />
              <br />
              Example: <code>/^prod/</code>
            </div>
          }
        />

        <VariableLegend>Selection options</VariableLegend>
        <SelectionOptionsEditor
          variable={variable}
          onPropChange={this.onSelectionOptionsChange}
          onMultiChanged={changeVariableMultiValue}
        />
      </>
    );
  }
}

export const DataSourceVariableEditor = connector(DataSourceVariableEditorUnConnected);
