import React, { PureComponent } from 'react';
import TopSection from './TopSection';
import BottomSection from './BottomSection';
import { contextSrv } from 'app/core/services/context_srv';
import appEvents from '../../app_events';

export class SideMenu extends PureComponent<any> {
  toggleSideMenu = () => {
    contextSrv.toggleSideMenu();
    appEvents.emit('toggle-sidemenu');
  };

  toggleSideMenuSmallBreakpoint = () => {
    appEvents.emit('toggle-sidemenu-mobile');
  };

  render() {
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
      <TopSection key="topsection" />,
      <BottomSection key="bottomsection" />,
    ];
  }
}
