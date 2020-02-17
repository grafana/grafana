import React, { PureComponent } from 'react';
import { Link } from 'react-router-dom';
import appEvents from '../../app_events';
import TopSection from './TopSection';
import BottomSection from './BottomSection';
import config from 'app/core/config';
import { CoreEvents } from 'app/types';
import { Branding } from 'app/core/components/Branding/Branding';

const homeUrl = config.appSubUrl || '/';

export class SideMenu extends PureComponent {
  toggleSideMenuSmallBreakpoint = () => {
    appEvents.emit(CoreEvents.toggleSidemenuMobile);
  };

  render() {
    return (
      <div className="sidemenu">
        <Link to={homeUrl}>
          <div className="sidemenu__logo" key="logo">
            <Branding.MenuLogo />
          </div>
        </Link>
        <div className="sidemenu__logo_small_breakpoint" onClick={this.toggleSideMenuSmallBreakpoint} key="hamburger">
          <i className="fa fa-bars" />
          <span className="sidemenu__close">
            <i className="fa fa-times" />
            &nbsp;Close
          </span>
        </div>
        <TopSection key="topsection" />
        <BottomSection key="bottomsection" />
      </div>
    );
  }
}
