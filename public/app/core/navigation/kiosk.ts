import { AppEvents, UrlQueryValue } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import appEvents from '../app_events';
import { KioskMode } from '../../types';

export function toggleKioskMode() {
  let kiosk = locationService.getSearchObject().kiosk;

  switch (kiosk) {
    case 'tv':
      kiosk = true;
      appEvents.emit(AppEvents.alertSuccess, ['Press ESC to exit Kiosk mode']);
      break;
    case '1':
    case true:
      kiosk = null;
      break;
    default:
      kiosk = 'tv';
  }

  locationService.partial({ kiosk });
}

export function getKioskMode(queryParam?: UrlQueryValue): KioskMode {
  switch (queryParam) {
    case 'tv':
      return KioskMode.TV;
    //  legacy support
    case '1':
    case true:
      return KioskMode.Full;
    default:
      return KioskMode.Off;
  }
}

export function exitKioskMode() {
  locationService.partial({ kiosk: null });
}
