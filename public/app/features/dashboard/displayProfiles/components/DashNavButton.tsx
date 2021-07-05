import { getConfig } from 'app/core/config';
import { get } from 'lodash';
import React, { ReactElement } from 'react';
import { DashNavButton, DashNavButtonProps } from '../../components/DashNav/DashNavButton';
import { useDisplayProfile } from '../state/hooks';
import { DisplayProfileMode } from '../types';

export function DashNavButtonWithDisplayProfile(
  props: DashNavButtonProps & { configPath: string }
): ReactElement | null {
  const profile = useDisplayProfile();
  const { configPath } = props;
  const mode = get(profile, configPath) as DisplayProfileMode | undefined;

  if (!getConfig().featureToggles.customKiosk) {
    return <DashNavButton {...props} />;
  }

  switch (mode) {
    case DisplayProfileMode.hidden:
      return null;

    default:
      return <DashNavButton {...props} />;
  }
}
