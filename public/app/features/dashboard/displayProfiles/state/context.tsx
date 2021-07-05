import React from 'react';
import { standardProfile } from '../profiles/standard';
import { DashboardDisplayProfile } from '../types';

export type OnChangeDisplayProfile = (profile: DashboardDisplayProfile) => void;

interface DisplayProfileContextType {
  profile: DashboardDisplayProfile;
  onChangeProfile: OnChangeDisplayProfile;
  enabled: boolean;
  onChangeEnabled: (enabled: boolean) => void;
}

export const DisplayProfileContext = React.createContext<DisplayProfileContextType>({
  profile: standardProfile,
  onChangeProfile: () => {},
  enabled: false,
  onChangeEnabled: () => {},
});
