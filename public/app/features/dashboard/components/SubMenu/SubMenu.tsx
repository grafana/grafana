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
  links?: DashboardLink[];
  hideVariables?: boolean;
  hideAnnotations?: boolean;
  hideLinks?: boolean;
  query?: string;
}

interface ConnectedProps {
  variables: VariableModel[];
  dashboard: DashboardModel;
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

  getVariables = () => {
    const { hideVariables, query } = this.props;
    if (hideVariables) {
      return [];
    }

    const variables = this.props.variables.filter(variable => variable.hide !== VariableHide.hideVariable);
    if (query) {
      const re = new RegExp(query as string);
      return variables.filter(variable => variable.name.match(re) !== null);
    }
    return variables;
  };

  getAnnotations = () => {
    const { dashboard, hideAnnotations, query } = this.props;
    if (hideAnnotations) {
      return [];
    }

    const annotations = dashboard.annotations.list.filter(annotation => annotation.hide !== true);
    if (query) {
      const re = new RegExp(query as string);
      return annotations.filter(annotation => annotation.name.match(re) !== null);
    }
    return annotations;
  };

  getLinks = () => {
    const { dashboard, hideLinks, query } = this.props;
    if (hideLinks) {
      return [];
    }

    const links = this.props.links || dashboard.links;
    if (query) {
      return [];
    }
    return links;
  };

  isSubMenuVisible = () => {
    const variables = this.getVariables();
    if (variables.length > 0) {
      return true;
    }

    const annotations = this.getAnnotations();
    if (annotations.length > 0) {
      return true;
    }

    const links = this.getLinks();
    return links.length > 0;
  };

  render() {
    const { dashboard } = this.props;

    if (!this.isSubMenuVisible()) {
      return null;
    }

    const variables = this.getVariables();
    const annotations = this.getAnnotations();
    const links = this.getLinks();

    return (
      <div className="submenu-controls">
        <SubMenuItems variables={variables} />
        <Annotations annotations={annotations} onAnnotationChanged={this.onAnnotationStateChanged} />
        <div className="gf-form gf-form--grow" />
        {dashboard && <DashboardLinks dashboard={dashboard} links={links} />}
        <div className="clearfix" />
      </div>
    );
  }
}

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = state => {
  return {
    variables: getSubMenuVariables(state.templating.variables),
    dashboard: state.dashboard.getModel() as DashboardModel,
  };
};

export const SubMenu = connect(mapStateToProps)(SubMenuUnConnected);
SubMenu.displayName = 'SubMenu';
