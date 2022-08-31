import { t } from '@lingui/macro';

import { AppEvents } from '@grafana/data';
import { locationService } from '@grafana/runtime';

import { KioskMode } from '../../types';
import appEvents from '../app_events';

export function toggleKioskMode() {
  let kiosk = locationService.getSearchObject().kiosk;

  switch (kiosk) {
    case 'tv':
      kiosk = true;
      appEvents.emit(AppEvents.alertSuccess, [
        t({ id: 'navigation.kiosk.tv-alert', message: 'Press ESC to exit Kiosk mode' }),
      ]);
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

export function getKioskMode(): KioskMode {
  const kiosk = locationService.getSearchObject().kiosk;

  switch (kiosk) {
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
