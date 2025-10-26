import { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { AdHocVariableModel, DataSourceInstanceSettings, getDataSourceRef } from '@grafana/data';
import { AdHocVariableForm } from 'app/features/dashboard-scene/settings/variables/components/AdHocVariableForm';
import { StoreState } from 'app/types/store';

import { initialVariableEditorState } from '../editor/reducer';
import { getAdhocVariableEditorState } from '../editor/selectors';
import { VariableEditorProps } from '../editor/types';
import { getVariablesState } from '../state/selectors';
import { toKeyedVariableIdentifier } from '../utils';

import { changeVariableDatasource } from './actions';

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
  }

  onDatasourceChanged = (ds: DataSourceInstanceSettings) => {
    this.props.changeVariableDatasource(toKeyedVariableIdentifier(this.props.variable), getDataSourceRef(ds));
  };

  render() {
    const { variable, extended } = this.props;

    return (
      <AdHocVariableForm
        datasource={variable.datasource ?? undefined}
        onDataSourceChange={this.onDatasourceChanged}
        infoText={extended?.infoText}
        datasourceSupported={variable.datasource === undefined ? false : true} // legacy behavior - will show data source settings even if not supported
      />
    );
  }
}

export const AdHocVariableEditor = connector(AdHocVariableEditorUnConnected);
