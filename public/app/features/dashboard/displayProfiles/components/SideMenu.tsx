import { SideMenu } from 'app/core/components/sidemenu/SideMenu';
import { getConfig } from 'app/core/config';
import React, { ReactElement } from 'react';
import { useDisplayProfile } from '../state/hooks';
import { DisplayProfileMode } from '../types';

export function SideMenuWithDisplayProfile(): ReactElement | null {
  const { sideMenu } = useDisplayProfile();

  if (!getConfig().featureToggles.customKiosk) {
    return <SideMenu />;
  }

  switch (sideMenu) {
    case DisplayProfileMode.hidden: {
      return null;
    }

    default: {
      return <SideMenu />;
    }
  }
}
