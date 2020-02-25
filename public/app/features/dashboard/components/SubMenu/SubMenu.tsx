import React, { PureComponent } from 'react';
import { connect, MapStateToProps } from 'react-redux';
import { StoreState } from '../../../../types';
import { VariableState } from '../../../templating/state/types';
import { VariablePicker } from '../../../templating/picker/VariablePicker';
import { e2e } from '@grafana/e2e';
import { getVariableStates } from '../../../templating/state/selectors';
import { VariableHide } from '../../../templating/variable';

interface OwnProps {}

interface ConnectedProps {
  variableStates: VariableState[];
}

interface DispatchProps {}

type Props = OwnProps & ConnectedProps & DispatchProps;

class SubMenuUnConnected extends PureComponent<Props> {
  render() {
    if (this.props.variableStates.length === 0) {
      return null;
    }

    const visibleVariableStates = this.props.variableStates.filter(
      state => state.variable.hide !== VariableHide.hideVariable
    );

    if (visibleVariableStates.length === 0) {
      return null;
    }

    return (
      <div className="submenu-controls">
        {visibleVariableStates.map(state => (
          <div className="submenu-item gf-form-inline" aria-label={e2e.pages.Dashboard.SubMenu.selectors.submenuItem}>
            <VariablePicker
              key={state.variable.uuid}
              picker={state.picker}
              editor={state.editor}
              variable={state.variable}
            />
          </div>
        ))}
      </div>
    );
  }
}

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = state => ({
  variableStates: getVariableStates(state),
});

export const SubMenu = connect(mapStateToProps)(SubMenuUnConnected);
SubMenu.displayName = 'SubMenu';
