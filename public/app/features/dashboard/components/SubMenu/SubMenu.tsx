import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { StoreState } from '../../../../types';
import { VariableState } from '../../../templating/state/types';
import { VariablePicker } from '../../../templating/picker/VariablePicker';
import { e2e } from '@grafana/e2e';

export interface Props {
  variables: Record<string, VariableState>;
}

class UnConnectedSubMenu extends PureComponent<Props> {
  render() {
    const variables = Object.values(this.props.variables);
    if (variables.length === 0) {
      return null;
    }

    return (
      <div className="submenu-controls">
        <div className="submenu-item gf-form-inline" aria-label={e2e.pages.Dashboard.SubMenu.selectors.submenuItem}>
          {variables.map(state => (
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

const mapStateToProps = (state: StoreState) => ({ variables: state.templating.variables });

export const SubMenu = connect(mapStateToProps)(UnConnectedSubMenu);
SubMenu.displayName = 'SubMenu';
