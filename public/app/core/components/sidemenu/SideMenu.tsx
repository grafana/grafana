import React, { FC, useCallback } from 'react';
import appEvents from '../../app_events';
import TopSection from './TopSection';
import BottomSection from './BottomSection';
import config from 'app/core/config';
import { CoreEvents, KioskMode } from 'app/types';
import { Branding } from 'app/core/components/Branding/Branding';
import { Icon } from '@grafana/ui';
import { useLocation } from 'react-router-dom';

const homeUrl = config.appSubUrl || '/';

export const SideMenu: FC = React.memo(() => {
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const kiosk = query.get('kiosk') as KioskMode;

  const toggleSideMenuSmallBreakpoint = useCallback(() => {
    appEvents.emit(CoreEvents.toggleSidemenuMobile);
  }, []);

  if (kiosk !== null) {
    return null;
  }

  return (
    <nav className="sidemenu" data-testid="sidemenu">
      <a href={homeUrl} className="sidemenu__logo" key="logo">
        <Branding.MenuLogo />
      </a>
      <div className="sidemenu__logo_small_breakpoint" onClick={toggleSideMenuSmallBreakpoint} key="hamburger">
        <Icon name="bars" size="xl" />
        <span className="sidemenu__close">
          <Icon name="times" />
          &nbsp;Close
        </span>
      </div>
      <TopSection key="topsection" />
      <BottomSection key="bottomsection" />
    </nav>
  );
});

SideMenu.displayName = 'SideMenu';
