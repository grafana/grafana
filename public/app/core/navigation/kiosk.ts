import { AppEvents } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import appEvents from '../app_events';

export function toggleKioskMode() {
  let kiosk = locationService.getSearch().get('kiosk');

  switch (kiosk) {
    case 'tv':
      kiosk = 'full';
      appEvents.emit(AppEvents.alertSuccess, ['Press ESC to exit Kiosk mode']);
      break;
    case '1':
    case '':
    case 'full':
      kiosk = null;
      break;
    default:
      kiosk = 'tv';
  }

  locationService.partial({ kiosk });
}

export function exitKioskMode() {
  locationService.partial({ kiosk: null });
}
