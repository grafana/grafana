import { css } from '@emotion/css';
import React, { PureComponent } from 'react';
import { connect, MapStateToProps } from 'react-redux';

import { AnnotationQuery, DataQuery, GrafanaTheme2 } from '@grafana/data';
import { stylesFactory, Themeable2, withTheme2 } from '@grafana/ui';

import { StoreState } from '../../../../types';
import { getSubMenuVariables, getVariablesState } from '../../../variables/state/selectors';
import { VariableModel } from '../../../variables/types';
import { DashboardModel } from '../../state';
import { DashboardLink } from '../../state/DashboardModel';

import { Annotations } from './Annotations';
import { DashboardLinks } from './DashboardLinks';
import { SubMenuItems } from './SubMenuItems';

interface OwnProps extends Themeable2 {
  dashboard: DashboardModel;
  links: DashboardLink[];
  annotations: AnnotationQuery[];
}

interface ConnectedProps {
  variables: VariableModel[];
}

interface DispatchProps {}

type Props = OwnProps & ConnectedProps & DispatchProps;

class SubMenuUnConnected extends PureComponent<Props> {
  onAnnotationStateChanged = (updatedAnnotation: AnnotationQuery<DataQuery>) => {
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

  render() {
    const { dashboard, variables, links, annotations, theme } = this.props;

    const styles = getStyles(theme);

    if (!dashboard.isSubMenuVisible()) {
      return null;
    }

    const readOnlyVariables = dashboard.meta.isSnapshot ?? false;

    return (
      <div className={styles.submenu}>
        <form aria-label="Template variables" className={styles.formStyles}>
          <SubMenuItems variables={variables} readOnly={readOnlyVariables} />
        </form>
        <Annotations
          annotations={annotations}
          onAnnotationChanged={this.onAnnotationStateChanged}
          events={dashboard.events}
        />
        <div className={styles.spacer} />
        {dashboard && <DashboardLinks dashboard={dashboard} links={links} />}
      </div>
    );
  }
}

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = (state, ownProps) => {
  const { uid } = ownProps.dashboard;
  const templatingState = getVariablesState(uid, state);
  return {
    variables: getSubMenuVariables(uid, templatingState.variables),
  };
};

const getStyles = stylesFactory((theme: GrafanaTheme2) => {
  return {
    formStyles: css`
      display: flex;
      flex-wrap: wrap;
      display: contents;
    `,
    submenu: css`
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      align-content: flex-start;
      align-items: flex-start;
      gap: ${theme.spacing(1)} ${theme.spacing(2)};
      padding: 0 0 ${theme.spacing(1)} 0;
    `,
    spacer: css({
      flexGrow: 1,
    }),
  };
});

export const SubMenu = withTheme2(connect(mapStateToProps)(SubMenuUnConnected));

SubMenu.displayName = 'SubMenu';
