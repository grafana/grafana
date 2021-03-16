import React, { PureComponent } from 'react';
import { MapDispatchToProps, MapStateToProps } from 'react-redux';

import { AdHocVariableModel } from '../types';
import { VariableEditorProps } from '../editor/types';
import { VariableEditorState } from '../editor/reducer';
import { AdHocVariableEditorState } from './reducer';
import { changeVariableDatasource, initAdHocVariableEditor } from './actions';
import { connectWithStore } from 'app/core/utils/connectWithReduxStore';
import { StoreState } from 'app/types';
import { Alert, InlineFieldRow, VerticalGroup } from '@grafana/ui';
import { VariableSectionHeader } from '../editor/VariableSectionHeader';
import { VariableSelectField } from '../editor/VariableSelectField';
import { SelectableValue } from '@grafana/data';

export interface OwnProps extends VariableEditorProps<AdHocVariableModel> {}

interface ConnectedProps {
  editor: VariableEditorState<AdHocVariableEditorState>;
}

interface DispatchProps {
  initAdHocVariableEditor: typeof initAdHocVariableEditor;
  changeVariableDatasource: typeof changeVariableDatasource;
}

type Props = OwnProps & ConnectedProps & DispatchProps;

export class AdHocVariableEditorUnConnected extends PureComponent<Props> {
  componentDidMount() {
    this.props.initAdHocVariableEditor();
  }

  onDatasourceChanged = (option: SelectableValue<string>) => {
    this.props.changeVariableDatasource(option.value ?? '');
  };

  render() {
    const { variable, editor } = this.props;
    const dataSources = editor.extended?.dataSources ?? [];
    const infoText = editor.extended?.infoText ?? null;
    const options = dataSources.map((ds) => ({ label: ds.text, value: ds.value ?? '' }));
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

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = (state, ownProps) => ({
  editor: state.templating.editor as VariableEditorState<AdHocVariableEditorState>,
});

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = {
  initAdHocVariableEditor,
  changeVariableDatasource,
};

export const AdHocVariableEditor = connectWithStore(
  AdHocVariableEditorUnConnected,
  mapStateToProps,
  mapDispatchToProps
);
