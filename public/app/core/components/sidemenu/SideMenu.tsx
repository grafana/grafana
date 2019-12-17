import React, { PureComponent } from 'react';
import appEvents from '../../app_events';
import TopSection from './TopSection';
import BottomSection from './BottomSection';
import { CoreEvents } from 'app/types';

export class SideMenu extends PureComponent {
  toggleSideMenuSmallBreakpoint = () => {
    appEvents.emit(CoreEvents.toggleSidemenuMobile);
  };

  render() {
    return [
      <div className="sidemenu__logo_small_breakpoint" onClick={this.toggleSideMenuSmallBreakpoint} key="hamburger">
        <i className="fa fa-bars" />
        <span className="sidemenu__close">
          <i className="fa fa-times" />
          &nbsp;Close
        </span>
      </div>,
      <TopSection key="topsection" />,
      <BottomSection key="bottomsection" />,
    ];
  }
}
