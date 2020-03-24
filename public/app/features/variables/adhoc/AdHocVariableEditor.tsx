import React, { PureComponent } from 'react';
import { MapDispatchToProps, MapStateToProps } from 'react-redux';

import { AdHocVariableModel } from '../../templating/types';
import { VariableEditorProps } from '../editor/types';
import { VariableEditorState } from '../editor/reducer';
import { AdHocVariableEditorState } from './reducer';
import { changeVariableDatasource, initAdHocVariableEditor } from './actions';
import { connectWithStore } from 'app/core/utils/connectWithReduxStore';
import { StoreState } from 'app/types';

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

  onDatasourceChanged = (event: React.ChangeEvent<HTMLSelectElement>) => {
    this.props.changeVariableDatasource(event.target.value);
  };

  render() {
    const { variable, editor } = this.props;
    const dataSources = editor.extended?.dataSources ?? [];
    const infoText = editor.extended?.infoText ?? null;

    return (
      <>
        <div className="gf-form-group">
          <h5 className="section-heading">Options</h5>
          <div className="gf-form max-width-21">
            <span className="gf-form-label width-8">Data source</span>
            <div className="gf-form-select-wrapper max-width-14">
              <select
                className="gf-form-input"
                required
                onChange={this.onDatasourceChanged}
                value={variable.datasource ?? ''}
                aria-label="Variable editor Form AdHoc DataSource select"
              >
                {dataSources.map(ds => (
                  <option key={ds.value ?? ''} value={ds.value ?? ''} label={ds.text}>
                    {ds.text}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {infoText && (
          <div className="alert alert-info gf-form-group" aria-label="Variable editor Form Alert">
            {infoText}
          </div>
        )}
      </>
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
