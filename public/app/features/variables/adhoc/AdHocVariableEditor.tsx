import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { Alert, InlineFieldRow, VerticalGroup } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';

import { AdHocVariableModel } from '../types';
import { VariableEditorProps } from '../editor/types';
import { VariableEditorState } from '../editor/reducer';
import { AdHocVariableEditorState } from './reducer';
import { changeVariableDatasource, initAdHocVariableEditor } from './actions';
import { StoreState } from 'app/types';
import { VariableSectionHeader } from '../editor/VariableSectionHeader';
import { VariableSelectField } from '../editor/VariableSelectField';

const mapStateToProps = (state: StoreState) => ({
  editor: state.templating.editor as VariableEditorState<AdHocVariableEditorState>,
});

const mapDispatchToProps = {
  initAdHocVariableEditor,
  changeVariableDatasource,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export interface OwnProps extends VariableEditorProps<AdHocVariableModel> {}

type Props = OwnProps & ConnectedProps<typeof connector>;

export class AdHocVariableEditorUnConnected extends PureComponent<Props> {
  componentDidMount() {
    this.props.initAdHocVariableEditor();
  }

  onDatasourceChanged = (option: SelectableValue<string>) => {
    this.props.changeVariableDatasource(option.value);
  };

  render() {
    const { variable, editor } = this.props;
    const dataSources = editor.extended?.dataSources ?? [];
    const infoText = editor.extended?.infoText ?? null;
    const options = dataSources.map((ds) => ({ label: ds.text, value: ds.value }));
    const value = options.find((o) => o.value === variable.datasource) ?? options[0];

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
