import React, { PureComponent } from 'react';
import { AdHocVariableModel } from '../../templating/variable';
import { VariableEditorProps } from '../editor/types';
import { VariableEditorState } from '../editor/reducer';
import { AdHocVariableEditorState } from './reducer';
import { initAdHocVariableEditor } from './actions';
import { connectWithStore } from 'app/core/utils/connectWithReduxStore';
import { MapDispatchToProps, MapStateToProps } from 'react-redux';
import { StoreState } from 'app/types';

export interface OwnProps extends VariableEditorProps<AdHocVariableModel> {}

interface ConnectedProps {
  editor: VariableEditorState<AdHocVariableEditorState>;
}

interface DispatchProps {
  initAdHocVariableEditor: typeof initAdHocVariableEditor;
}

type Props = OwnProps & ConnectedProps & DispatchProps;

export class AdHocVariableEditorUnConnected extends PureComponent<Props> {
  componentDidMount() {
    this.props.initAdHocVariableEditor();
  }

  render() {
    const { extended } = this.props.editor;

    return (
      <div className="gf-form-group">
        <h5 className="section-heading">Options</h5>
        <div className="gf-form max-width-21">
          <span className="gf-form-label width-8">Data source</span>
          <div className="gf-form-select-wrapper max-width-14">
            <select
              className="gf-form-input"
              ng-model="current.datasource"
              required
              ng-change="validate()"
              aria-label="Variable editor Form AdHoc DataSource select"
            >
              {extended?.dataSourceTypes?.length &&
                extended?.dataSourceTypes?.map(ds => (
                  <option key={ds.value ?? ''} value={ds.value ?? ''} label={ds.text}>
                    {ds.text}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>
    );
  }
}

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = (state, ownProps) => ({
  editor: state.templating.editor as VariableEditorState<AdHocVariableEditorState>,
});

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = {
  initAdHocVariableEditor,
};

export const AdHocVariableEditor = connectWithStore(
  AdHocVariableEditorUnConnected,
  mapStateToProps,
  mapDispatchToProps
);
