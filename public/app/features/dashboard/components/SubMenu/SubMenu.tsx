import React, { PureComponent } from 'react';
import { connect, MapStateToProps } from 'react-redux';
import { StoreState } from '../../../../types';
import { VariableState } from '../../../templating/state/types';
import { VariablePicker } from '../../../templating/picker/VariablePicker';
import { e2e } from '@grafana/e2e';
import { getVariableStates } from '../../../templating/state/selectors';
import { VariableHide } from '../../../templating/variable';
import { DashboardModel } from '../../state';
import { Switch } from '@grafana/ui';
import { AngularDashboardLinks } from './AngularDashboardLinks';

interface OwnProps {
  dashboard: DashboardModel;
}

interface ConnectedProps {
  variableStates: VariableState[];
}

interface DispatchProps {}

type Props = OwnProps & ConnectedProps & DispatchProps;

class SubMenuUnConnected extends PureComponent<Props> {
  onAnnotationStateChanged = (updatedAnnotation: any, event?: React.SyntheticEvent<HTMLInputElement>) => {
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

  isSubMenuVisible = (visibleVariableStates: VariableState[], visibleAnnotations: any[]) => {
    if (this.props.dashboard.links.length > 0) {
      return true;
    }

    if (visibleVariableStates.length > 0) {
      return true;
    }

    return visibleAnnotations.length > 0;
  };

  render() {
    const visibleAnnotations = this.props.dashboard.annotations.list.filter(annotation => annotation.hide !== true);
    const visibleVariableStates = this.props.variableStates.filter(
      state => state.variable.hide !== VariableHide.hideVariable
    );

    if (!this.isSubMenuVisible(visibleVariableStates, visibleAnnotations)) {
      return null;
    }

    return (
      <div className="submenu-controls">
        {visibleVariableStates.map(state => (
          <div
            key={state.variable.uuid}
            className="submenu-item gf-form-inline"
            aria-label={e2e.pages.Dashboard.SubMenu.selectors.submenuItem}
          >
            <VariablePicker picker={state.picker} editor={state.editor} variable={state.variable} />
          </div>
        ))}
        {visibleAnnotations.map(annotation => {
          return (
            <div
              key={annotation.name}
              className={annotation.enable ? 'submenu-item' : 'submenu-item annotation-disabled'}
            >
              <Switch
                label={annotation.name}
                className="gf-form"
                checked={annotation.enable}
                onChange={event => this.onAnnotationStateChanged(annotation, event)}
              />
            </div>
          );
        })}
        {this.props.dashboard.links.length === 0 ? null : <AngularDashboardLinks dashboard={this.props.dashboard} />}
      </div>
    );
  }
}

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = state => ({
  variableStates: getVariableStates(state),
});

export const SubMenu = connect(mapStateToProps)(SubMenuUnConnected);
SubMenu.displayName = 'SubMenu';
