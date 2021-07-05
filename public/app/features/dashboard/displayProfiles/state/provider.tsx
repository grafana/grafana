import React, { useMemo, useState } from 'react';
import { tvProfile } from '../profiles/tv';
import { DisplayProfileContext } from './context';

export function DisplayProfileProvider({ children }: React.PropsWithChildren<any>): React.ReactElement {
  const [profile, setProfile] = useState(tvProfile);
  const [enabled, setEnabled] = useState(false);

  const value = useMemo(
    () => ({
      profile,
      onChangeProfile: setProfile,
      enabled,
      onChangeEnabled: (value: boolean) => setEnabled(value),
    }),
    [profile, enabled]
  );

  return <DisplayProfileContext.Provider value={value}>{children}</DisplayProfileContext.Provider>;
}
