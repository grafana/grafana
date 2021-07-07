import { DashboardDisplayProfile } from '../types';
import { customProfile } from './custom';
import { kioskProfile } from './kiosk';
import { standardProfile } from './standard';
import { tvProfile } from './tv';

export enum DisplayProfileId {
  kiosk = 'kiosk',
  tv = 'tv',
  custom = 'custom',
  standard = 'standard',
}

export function getDisplayProfile(id: DisplayProfileId): DashboardDisplayProfile | undefined {
  switch (id) {
    case DisplayProfileId.custom:
      return { ...customProfile };
    case DisplayProfileId.tv:
      return tvProfile;
    case DisplayProfileId.kiosk:
      return kioskProfile;
    case DisplayProfileId.standard:
      return standardProfile;
    default:
      return;
  }
}
