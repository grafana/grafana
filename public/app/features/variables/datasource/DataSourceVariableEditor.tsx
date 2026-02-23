import { FormEvent, PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { DataSourceVariableModel, SelectableValue, VariableWithMultiSupport } from '@grafana/data';
import { DataSourceVariableForm } from 'app/features/dashboard-scene/settings/variables/components/DataSourceVariableForm';
import { StoreState } from 'app/types/store';

import { initialVariableEditorState } from '../editor/reducer';
import { getDatasourceVariableEditorState } from '../editor/selectors';
import { OnPropChangeArguments, VariableEditorProps } from '../editor/types';
import { changeVariableMultiValue } from '../state/actions';
import { getVariablesState } from '../state/selectors';
import { toKeyedVariableIdentifier } from '../utils';

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

  onMultiChanged = (event: FormEvent<HTMLInputElement>) => {
    this.props.changeVariableMultiValue(toKeyedVariableIdentifier(this.props.variable), event.currentTarget.checked);
  };

  onIncludeAllChanged = (event: FormEvent<HTMLInputElement>) => {
    this.onSelectionOptionsChange({ propName: 'includeAll', propValue: event.currentTarget.checked });
  };

  onAllValueChanged = (event: FormEvent<HTMLInputElement>) => {
    this.onSelectionOptionsChange({ propName: 'allValue', propValue: event.currentTarget.value });
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
    const { variable, extended } = this.props;

    const typeOptions = extended?.dataSourceTypes?.length
      ? extended.dataSourceTypes?.map((ds) => ({ value: ds.value ?? '', label: ds.text }))
      : [];

    return (
      <DataSourceVariableForm
        query={variable.query}
        regex={variable.regex}
        multi={variable.multi}
        includeAll={variable.includeAll}
        optionTypes={typeOptions}
        onChange={this.onDataSourceTypeChanged}
        onRegExBlur={this.onRegExBlur}
        onMultiChange={this.onMultiChanged}
        onIncludeAllChange={this.onIncludeAllChanged}
        onAllValueChange={this.onAllValueChanged}
      />
    );
  }
}

export const DataSourceVariableEditor = connector(DataSourceVariableEditorUnConnected);
