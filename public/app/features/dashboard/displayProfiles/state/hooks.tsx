import React, { useContext, useCallback } from 'react';
import { standardProfile } from '../profiles/standard';
import { DashboardDisplayProfile } from '../types';
import { OnChangeDisplayProfile, DisplayProfileContext } from './context';

export function useDisplayProfile(): DashboardDisplayProfile {
  const { profile, enabled } = useContext(DisplayProfileContext);

  if (!enabled) {
    return standardProfile;
  }

  return profile;
}

export function useOnToggleDisplayProfile(): () => void {
  const { onChangeEnabled, enabled } = useContext(DisplayProfileContext);

  return useCallback(() => {
    return onChangeEnabled(!enabled);
  }, [enabled, onChangeEnabled]);
}

export function useOnChangeDisplayProfile(): OnChangeDisplayProfile {
  const { onChangeProfile } = useContext(DisplayProfileContext);
  return onChangeProfile;
}

/** HOC for the non-functional components */
type ToggleDisplayProfileProps = {
  children: (onToggle: () => void) => React.ReactElement;
};

export function ToggleDisplayProfile({ children }: ToggleDisplayProfileProps): React.ReactElement {
  const toggler = useOnToggleDisplayProfile();
  return children(toggler);
}

type ChangeDashboardProfileProps = {
  children: (onChangeConfig: OnChangeDisplayProfile) => React.ReactElement;
};

export function ChangeDisplayProfile({ children }: ChangeDashboardProfileProps): React.ReactElement {
  const onChangeConfig = useOnChangeDisplayProfile();
  return children(onChangeConfig);
}
