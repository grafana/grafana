import { DashboardDisplayProfile } from '../types';
import { customProfile } from './custom';
import { kioskProfile } from './kiosk';
import { tvProfile } from './tv';

export enum DisplayProfileId {
  kiosk = 'kiosk',
  tv = 'tv',
  custom = 'custom',
}

export function getProfile(id: DisplayProfileId): DashboardDisplayProfile | undefined {
  switch (id) {
    case DisplayProfileId.custom:
      return customProfile;
    case DisplayProfileId.tv:
      return tvProfile;
    case DisplayProfileId.kiosk:
      return kioskProfile;
    default:
      return;
  }
}
