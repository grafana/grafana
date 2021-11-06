import React, { PureComponent } from 'react';
import { connect, MapStateToProps } from 'react-redux';
import { StoreState } from '../../../../types';
import { getSubMenuVariables } from '../../../variables/state/selectors';
import { VariableModel } from '../../../variables/types';
import { DashboardModel } from '../../state';
import { DashboardLinks } from './DashboardLinks';
import { Annotations } from './Annotations';
import { SubMenuItems } from './SubMenuItems';
import { DashboardLink } from '../../state/DashboardModel';
import { AnnotationQuery } from '@grafana/data';
import { ToolbarButton } from '@grafana/ui';
import { css } from '@emotion/css';

interface OwnProps {
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
  state = { pinned: false };
  ref: any;

  constructor(props: Props) {
    super(props);
    this.ref = React.createRef();
  }

  handleResizeAndScroll = (e: Event) => {
    if (!this.props.dashboard.pinSubMenu) {
      return;
    }
    if (e.type === 'scroll' && this.state.pinned) {
      return;
    }
    this.setState({ pinned: true });
    this.forceUpdate();
  };

  componentDidMount() {
    window.addEventListener('resize', this.handleResizeAndScroll.bind(this));
    window.addEventListener('scroll', this.handleResizeAndScroll.bind(this), true);
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.handleResizeAndScroll.bind(this));
    window.removeEventListener('scroll', this.handleResizeAndScroll.bind(this), true);
  }

  onPinMenuClicked = () => {
    this.props.dashboard.pinMenuSwitch();
    this.forceUpdate();
  };

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

  render() {
    const { dashboard, variables, links, annotations } = this.props;

    if (!dashboard.isSubMenuVisible()) {
      return null;
    }

    const pinned = dashboard.pinSubMenu && this.state.pinned;
    return (
      <>
        <div
          ref={(node) => (this.ref = node)}
          className="submenu-controls"
          style={{ zIndex: 10, position: pinned ? 'fixed' : 'inherit' }}
        >
          <form aria-label="Template variables" className={styles}>
            <SubMenuItems variables={variables} />
          </form>
          <Annotations
            annotations={annotations}
            onAnnotationChanged={this.onAnnotationStateChanged}
            events={dashboard.events}
          />
          <div className="gf-form gf-form--grow" />
          {dashboard && <DashboardLinks dashboard={dashboard} links={links} />}
          <div style={{ paddingRight: pinned ? 16 : 0 }}>
            <ToolbarButton
              icon={dashboard.pinSubMenu ? 'lock' : 'unlock'}
              tooltip="Pin sub menu position"
              onClick={this.onPinMenuClicked}
            />
          </div>
          <div className="clearfix" />
        </div>
        {pinned && <div className="submenu-controls" style={{ height: this.ref.clientHeight }}></div>}
      </>
    );
  }
}

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = (state) => {
  return {
    variables: getSubMenuVariables(state.templating.variables),
  };
};

const styles = css`
  display: flex;
  flex-wrap: wrap;
  display: contents;
`;

export const SubMenu = connect(mapStateToProps)(SubMenuUnConnected);

SubMenu.displayName = 'SubMenu';
