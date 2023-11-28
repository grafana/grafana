import { KioskMode } from '../../types';
// TODO Remove after topnav feature toggle is permanent and old NavBar is removed
export function getKioskMode(queryParams) {
    switch (queryParams.kiosk) {
        case 'tv':
            return KioskMode.TV;
        //  legacy support
        case '1':
        case true:
            return KioskMode.Full;
        default:
            return null;
    }
}
//# sourceMappingURL=kiosk.js.map