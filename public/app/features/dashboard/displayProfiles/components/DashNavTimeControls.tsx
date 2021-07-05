import { getConfig } from 'app/core/config';
import React, { ReactElement } from 'react';
import { DashNavTimeControls, Props as DashNavTimeControlsProps } from '../../components/DashNav/DashNavTimeControls';
import { useDisplayProfile } from '../state/hooks';
import { DisplayProfileMode } from '../types';

export function DashNavTimeControlsWithDisplayProfile(props: DashNavTimeControlsProps): ReactElement | null {
  const {
    dashNav: { timePicker },
  } = useDisplayProfile();

  if (!getConfig().featureToggles.customKiosk) {
    return <DashNavTimeControls {...props} />;
  }

  switch (timePicker) {
    case DisplayProfileMode.hidden: {
      return null;
    }

    default: {
      return <DashNavTimeControls {...props} />;
    }
  }
}
