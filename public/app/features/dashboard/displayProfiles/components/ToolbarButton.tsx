import React, { ReactElement } from 'react';
import { ToolbarButton, ToolbarButtonProps } from '@grafana/ui';
import { useDisplayProfile } from '../state/hooks';
import { DisplayProfileMode } from '../types';
import { get } from 'lodash';
import { getConfig } from 'app/core/config';

export function ToolbarButtonWithDisplayProfile(
  props: ToolbarButtonProps & { configPath: string }
): ReactElement | null {
  const profile = useDisplayProfile();
  const { configPath } = props;
  const mode = get(profile, configPath) as DisplayProfileMode | undefined;

  if (!getConfig().featureToggles.customKiosk) {
    return <ToolbarButton {...props} />;
  }

  switch (mode) {
    case DisplayProfileMode.hidden:
      return null;

    default:
      return <ToolbarButton {...props} />;
  }
}
