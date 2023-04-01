import { UrlQueryMap } from '@grafana/data';

// import { locationService } from '@grafana/runtime';
// import appEvents from '../app_events';
import { KioskMode } from '../../types';

// export function toggleKioskMode() {
//   let kiosk = locationService.getSearchObject().kiosk;

//   switch (kiosk) {
//     case 'tv':
//       kiosk = true;
//       appEvents.emit(AppEvents.alertSuccess, ['Press ESC to exit Kiosk mode']);
//       break;
//     case 'embedded':
//       // Embedded kiosk mode is inescapable
//       return;
//     case '1':
//     case true:
//       kiosk = null;
//       break;
//     default:
//       kiosk = 'tv';
//   }

//   locationService.partial({ kiosk });
// }

// TODO Remove after topnav feature toggle is permanent and old NavBar is removed
export function getKioskMode(queryParams: UrlQueryMap): KioskMode | null {
  switch (queryParams.kiosk) {
    case 'tv':
      return KioskMode.TV;
    //  legacy support
    case 'embedded':
      return KioskMode.Embedded;
    case '1':
    case true:
      return KioskMode.Full;
    default:
      return null;
  }
}

// export function exitKioskMode() {
//   const kiosk = locationService.getSearchObject().kiosk;
//   if (kiosk == 'embedded') {
//     // Embedded kiosk mode is inescapable
//     return;
//   }
//   locationService.partial({ kiosk: null });
// }
