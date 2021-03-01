import { AppEvents } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import appEvents from '../app_events';
import { KioskMode } from '../../types';

export function toggleKioskMode() {
  let kiosk;

  switch (locationService.getSearch().get('kiosk') as KioskMode) {
    case 'tv':
      kiosk = 'full';
      appEvents.emit(AppEvents.alertSuccess, ['Press ESC to exit Kiosk mode']);
      break;
    //  legacy support
    case '1' as KioskMode:
    //  legacy support
    case '' as KioskMode:
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
