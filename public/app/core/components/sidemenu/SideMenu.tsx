import React, { PureComponent } from 'react';
import _ from 'lodash';
import TopSection from './TopSection/TopSection';
import BottomSection from './BottomSection/BottomSection';
import config from 'app/core/config';
import { contextSrv } from 'app/core/services/context_srv';
import appEvents from '../../app_events';

export interface Props {}
export interface State {
  user: {};
  bottomNav: any[];
  mainLinks: any[];
  isSignedIn: boolean;
}

export class SideMenu extends PureComponent<Props, State> {
  constructor(props) {
    super(props);

    const navTree = _.cloneDeep(config.bootData.navTree);

    this.state = {
      mainLinks: _.filter(navTree, item => !item.hideFromMenu),
      bottomNav: _.filter(navTree, item => item.hideFromMenu),
      isSignedIn: contextSrv.isSignedIn,
      user: contextSrv.user,
    };
  }

  toggleSideMenu = () => {
    contextSrv.toggleSideMenu();
    appEvents.emit('toggle-sidemenu');
  };

  toggleSideMenuSmallBreakpoint = () => {
    appEvents.emit('toggle-sidemenu-mobile');
  };

  render() {
    const { mainLinks, isSignedIn, bottomNav } = this.state;

    const loginUrl = `login?redirect=${encodeURIComponent(window.location.pathname)}`;

    return [
      <div className="sidemenu__logo" onClick={this.toggleSideMenu} key="logo">
        <img src="public/img/grafana_icon.svg" alt="graphana_logo" />
      </div>,
      <div className="sidemenu__logo_small_breakpoint" onClick={this.toggleSideMenuSmallBreakpoint} key="hamburger">
        <i className="fa fa-bars" />
        <span className="sidemenu__close">
          <i className="fa fa-times" />&nbsp;Close
        </span>
      </div>,
      <TopSection mainLinks={mainLinks} key="topsection" />,
      <BottomSection bottomNav={bottomNav} isSignedIn={isSignedIn} loginUrl={loginUrl} key="bottomsection" />,
    ];
  }
}
