import { UrlQueryMap } from '@grafana/data';
import { KioskMode } from 'app/types/dashboard';

// TODO Remove after topnav feature toggle is permanent and old NavBar is removed
export function getKioskMode(queryParams: UrlQueryMap): KioskMode | null {
  switch (queryParams.kiosk) {
    //  legacy support
    case '1':
    case true:
      return KioskMode.Full;
    default:
      return null;
  }
}
