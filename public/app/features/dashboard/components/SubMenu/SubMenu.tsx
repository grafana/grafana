import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { StoreState } from '../../../../types';
import { VariableState } from '../../../templating/state/types';
import { VariablePicker } from '../../../templating/picker/VariablePicker';

export interface Props {
  variables: Record<string, VariableState>;
}

class UnConnectedSubMenu extends PureComponent<Props> {
  render() {
    const variables = Object.values(this.props.variables);
    return (
      <>
        {variables.map(state => (
          <VariablePicker picker={state.picker} editor={state.editor} variable={state.variable} />
        ))}
      </>
    );
  }
}

const mapStateToProps = (state: StoreState) => ({ variables: state.templating.variables });

export const SubMenu = connect(mapStateToProps)(UnConnectedSubMenu);
SubMenu.displayName = 'SubMenu';
