import { css } from '@emotion/css';
import { PureComponent } from 'react';
import * as React from 'react';
import { connect, MapStateToProps } from 'react-redux';

import { AnnotationQuery, DataQuery, TypedVariableModel, GrafanaTheme2 } from '@grafana/data';
import { DashboardLink } from '@grafana/schema';
import { stylesFactory, Themeable2, withTheme2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { StoreState } from '../../../../types';
import { getSubMenuVariables, getVariablesState } from '../../../variables/state/selectors';
import { DashboardModel } from '../../state/DashboardModel';

import { Annotations } from './Annotations';
import { DashboardLinks } from './DashboardLinks';
import { SubMenuItems } from './SubMenuItems';

interface OwnProps extends Themeable2 {
  dashboard: DashboardModel;
  links: DashboardLink[];
  annotations: AnnotationQuery[];
}

interface ConnectedProps {
  variables: TypedVariableModel[];
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

  disableSubmitOnEnter = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
  };

  render() {
    const { dashboard, variables, links, annotations, theme } = this.props;

    const styles = getStyles(theme);

    const readOnlyVariables = dashboard.meta.isSnapshot ?? false;

    return (
      <div className={styles.submenu}>
        <form
          aria-label={t('dashboard.sub-menu-un-connected.aria-label-template-variables', 'Template variables')}
          className={styles.formStyles}
          onSubmit={this.disableSubmitOnEnter}
        >
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
    formStyles: css({
      display: 'contents',
      flexWrap: 'wrap',
    }),
    submenu: css({
      display: 'flex',
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignContent: 'flex-start',
      alignItems: 'flex-start',
      gap: `${theme.spacing(1)} ${theme.spacing(2)}`,
      padding: `0 0 ${theme.spacing(1)} 0`,
    }),
    spacer: css({
      flexGrow: 1,
    }),
  };
});

export const SubMenu = withTheme2(connect(mapStateToProps)(SubMenuUnConnected));

SubMenu.displayName = 'SubMenu';
