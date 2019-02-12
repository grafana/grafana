import React, { PureComponent } from 'react';
import appEvents from '../../app_events';
import { contextSrv } from 'app/core/services/context_srv';
import TopSection from './TopSection';
import BottomSection from './BottomSection';
import { store } from 'app/store/store';

export class SideMenu extends PureComponent {
  toggleSideMenu = () => {
    // ignore if we just made a location change, stops hiding sidemenu on double clicks of back button
    const timeSinceLocationChanged = new Date().getTime() - store.getState().location.lastUpdated;
    if (timeSinceLocationChanged < 1000) {
      return;
    }

    contextSrv.toggleSideMenu();
    appEvents.emit('toggle-sidemenu');
  };

  toggleSideMenuSmallBreakpoint = () => {
    appEvents.emit('toggle-sidemenu-mobile');
  };

  render() {
    return [
      <div className="sidemenu__logo" onClick={this.toggleSideMenu} key="logo">
        <img src="public/img/grafana_icon.svg" alt="Grafana" />
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
