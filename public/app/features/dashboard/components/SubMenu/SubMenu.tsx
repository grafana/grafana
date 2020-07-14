import React, { PureComponent } from 'react';
import { connect, MapStateToProps } from 'react-redux';
import { StoreState } from '../../../../types';
import { getSubMenuVariables } from '../../../variables/state/selectors';
import { VariableHide, VariableModel } from '../../../variables/types';
import { DashboardModel } from '../../state';
import { DashboardLinks } from './DashboardLinks';
import { Annotations } from './Annotations';
import { SubMenuItems } from './SubMenuItems';
import { DashboardLink } from '../../state/DashboardModel';

interface OwnProps {
  dashboard: DashboardModel;
}

interface ConnectedProps {
  variables: VariableModel[];
  links: DashboardLink[];
}

interface DispatchProps {}

type Props = OwnProps & ConnectedProps & DispatchProps;

class SubMenuUnConnected extends PureComponent<Props> {
  onAnnotationStateChanged = (updatedAnnotation: any) => {
    // we're mutating dashboard state directly here until annotations are in Redux.
    for (let index = 0; index < this.props.dashboard.annotations.list.length; index++) {
      const annotation = this.props.dashboard.annotations.list[index];
      if (annotation.name === updatedAnnotation.name) {
        annotation.enable = !annotation.enable;
        break;
      }
    }
    this.props.dashboard.startRefresh();
    this.forceUpdate();
  };

  isSubMenuVisible = () => {
    if (this.props.dashboard.links.length > 0) {
      return true;
    }

    const visibleVariables = this.props.variables.filter(variable => variable.hide !== VariableHide.hideVariable);
    if (visibleVariables.length > 0) {
      return true;
    }

    const visibleAnnotations = this.props.dashboard.annotations.list.filter(annotation => annotation.hide !== true);
    return visibleAnnotations.length > 0;
  };

  render() {
    const { dashboard, variables } = this.props;
    if (!this.isSubMenuVisible()) {
      return null;
    }

    return (
      <div className="submenu-controls">
        <SubMenuItems variables={variables} />
        <Annotations annotations={dashboard.annotations.list} onAnnotationChanged={this.onAnnotationStateChanged} />
        <div className="gf-form gf-form--grow" />
        {dashboard && <DashboardLinks dashboard={dashboard} />}
        <div className="clearfix" />
      </div>
    );
  }
}

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = state => {
  return {
    variables: getSubMenuVariables(state.templating.variables),

    /** Haven't found any other way to force links being passed to the links menu. Not spreading into new array makes
     * the DashboardLinks not re-render as it gets reference to the same array in the model.
     * Ref: https://github.com/grafana/grafana/issues/26289
     */
    links: [...state.dashboard.getModel()?.links],
  };
};

export const SubMenu = connect(mapStateToProps)(SubMenuUnConnected);
SubMenu.displayName = 'SubMenu';
