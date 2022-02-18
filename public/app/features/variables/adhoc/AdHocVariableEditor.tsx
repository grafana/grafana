import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { Alert, InlineFieldRow, VerticalGroup } from '@grafana/ui';
import { DataSourceRef, SelectableValue } from '@grafana/data';

import { AdHocVariableModel } from '../types';
import { VariableEditorProps } from '../editor/types';
import { initialVariableEditorState } from '../editor/reducer';
import { changeVariableDatasource, initAdHocVariableEditor } from './actions';
import { StoreState } from 'app/types';
import { VariableSectionHeader } from '../editor/VariableSectionHeader';
import { VariableSelectField } from '../editor/VariableSelectField';
import { getAdhocVariableEditorState } from '../editor/selectors';
import { getVariablesState } from '../state/selectors';
import { toKeyedVariableIdentifier } from '../utils';

const mapStateToProps = (state: StoreState, ownProps: OwnProps) => {
  const { rootStateKey } = ownProps.variable;

  if (!rootStateKey) {
    console.error('AdHocVariableEditor: variable has no rootStateKey');
    return {
      extended: getAdhocVariableEditorState(initialVariableEditorState),
    };
  }

  const { editor } = getVariablesState(rootStateKey, state);

  return {
    extended: getAdhocVariableEditorState(editor),
  };
};

const mapDispatchToProps = {
  initAdHocVariableEditor,
  changeVariableDatasource,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export interface OwnProps extends VariableEditorProps<AdHocVariableModel> {}

type Props = OwnProps & ConnectedProps<typeof connector>;

export class AdHocVariableEditorUnConnected extends PureComponent<Props> {
  componentDidMount() {
    const { rootStateKey } = this.props.variable;
    if (!rootStateKey) {
      console.error('AdHocVariableEditor: variable has no rootStateKey');
      return;
    }

    this.props.initAdHocVariableEditor(rootStateKey);
  }

  onDatasourceChanged = (option: SelectableValue<DataSourceRef>) => {
    this.props.changeVariableDatasource(toKeyedVariableIdentifier(this.props.variable), option.value);
  };

  render() {
    const { variable, extended } = this.props;
    const dataSources = extended?.dataSources ?? [];
    const infoText = extended?.infoText ?? null;
    const options = dataSources.map((ds) => ({ label: ds.text, value: ds.value }));
    const value = options.find((o) => o.value?.uid === variable.datasource?.uid) ?? options[0];

    return (
      <VerticalGroup spacing="xs">
        <VariableSectionHeader name="Options" />
        <VerticalGroup spacing="sm">
          <InlineFieldRow>
            <VariableSelectField
              name="Data source"
              value={value}
              options={options}
              onChange={this.onDatasourceChanged}
              labelWidth={10}
            />
          </InlineFieldRow>

          {infoText ? <Alert title={infoText} severity="info" /> : null}
        </VerticalGroup>
      </VerticalGroup>
    );
  }
}

export const AdHocVariableEditor = connector(AdHocVariableEditorUnConnected);
