import React, { ReactElement } from 'react';
import { get } from 'lodash';
import { useDisplayProfile } from '../state/hooks';
import { DisplayProfileMode } from '../types';

type HidableInDisplayProfileProps = {
  pathInProfile: string;
  children: ReactElement | null | (() => ReactElement | null);
};

export function HidableInDisplayProfile(props: HidableInDisplayProfileProps): ReactElement | null {
  const { pathInProfile, children } = props;
  const profile = useDisplayProfile();
  const mode = get(profile, pathInProfile) as DisplayProfileMode | undefined;

  if (mode === DisplayProfileMode.hidden) {
    return null;
  }

  if (typeof children === 'function') {
    return children();
  }

  return <>{children}</>;
}
