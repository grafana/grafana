import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { StoreState } from '../../../../types';
import { VariableState } from '../../../templating/state/types';
import { VariablePicker } from '../../../templating/picker/VariablePicker';
import { e2e } from '@grafana/e2e';

export interface Props {
  variableStates: VariableState[];
}

class UnConnectedSubMenu extends PureComponent<Props> {
  render() {
    if (this.props.variableStates.length === 0) {
      return null;
    }

    return (
      <div className="submenu-controls">
        <div className="submenu-item gf-form-inline" aria-label={e2e.pages.Dashboard.SubMenu.selectors.submenuItem}>
          {this.props.variableStates.map(state => (
            <VariablePicker
              key={state.variable.uuid}
              picker={state.picker}
              editor={state.editor}
              variable={state.variable}
            />
          ))}
        </div>
      </div>
    );
  }
}

const mapStateToProps = (state: StoreState) => ({ variableStates: Object.values(state.templating.variables) });

export const SubMenu = connect(mapStateToProps)(UnConnectedSubMenu);
SubMenu.displayName = 'SubMenu';
