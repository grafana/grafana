import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { StoreState } from '../../../../types';

class UnConnectedSubMenu extends PureComponent {
  render() {
    return <div>New SubMenu</div>;
  }
}

const mapStateToProps = (state: StoreState) => state.templating.variables;

export const SubMenu = connect(mapStateToProps)(UnConnectedSubMenu);
SubMenu.displayName = 'SubMenu';
