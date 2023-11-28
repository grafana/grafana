import { useObservable } from 'react-use';
import { BehaviorSubject } from 'rxjs';
import { AppEvents, PageLayoutType } from '@grafana/data';
import { config, locationService, reportInteraction } from '@grafana/runtime';
import appEvents from 'app/core/app_events';
import { t } from 'app/core/internationalization';
import store from 'app/core/store';
import { isShallowEqual } from 'app/core/utils/isShallowEqual';
import { KioskMode } from 'app/types';
const DOCKED_LOCAL_STORAGE_KEY = 'grafana.navigation.docked';
export class AppChromeService {
    constructor() {
        this.searchBarStorageKey = 'SearchBar_Hidden';
        this.routeChangeHandled = true;
        this.state = new BehaviorSubject({
            chromeless: true,
            sectionNav: { node: { text: t('nav.home.title', 'Home') }, main: { text: '' } },
            searchBarHidden: store.getBool(this.searchBarStorageKey, false),
            megaMenu: config.featureToggles.dockedMegaMenu && store.getBool(DOCKED_LOCAL_STORAGE_KEY, false) ? 'docked' : 'closed',
            kioskMode: null,
            layout: PageLayoutType.Canvas,
        });
        this.setMegaMenu = (newMegaMenuState) => {
            if (config.featureToggles.dockedMegaMenu) {
                store.set(DOCKED_LOCAL_STORAGE_KEY, newMegaMenuState === 'docked');
                reportInteraction('grafana_mega_menu_state', { state: newMegaMenuState });
            }
            else {
                reportInteraction('grafana_toggle_menu_clicked', { action: newMegaMenuState === 'open' ? 'open' : 'close' });
            }
            this.update({ megaMenu: newMegaMenuState });
        };
        this.onToggleSearchBar = () => {
            const { searchBarHidden, kioskMode } = this.state.getValue();
            const newSearchBarHidden = !searchBarHidden;
            store.set(this.searchBarStorageKey, newSearchBarHidden);
            if (kioskMode) {
                locationService.partial({ kiosk: null });
            }
            this.update({ searchBarHidden: newSearchBarHidden, kioskMode: null });
        };
        this.onToggleKioskMode = () => {
            const nextMode = this.getNextKioskMode();
            this.update({ kioskMode: nextMode });
            locationService.partial({ kiosk: this.getKioskUrlValue(nextMode) });
        };
    }
    setMatchedRoute(route) {
        if (this.currentRoute !== route) {
            this.currentRoute = route;
            this.routeChangeHandled = false;
        }
    }
    update(update) {
        var _a, _b;
        const current = this.state.getValue();
        const newState = Object.assign({}, current);
        // when route change update props from route and clear fields
        if (!this.routeChangeHandled) {
            newState.actions = undefined;
            newState.pageNav = undefined;
            newState.sectionNav = { node: { text: t('nav.home.title', 'Home') }, main: { text: '' } };
            newState.chromeless = (_a = this.currentRoute) === null || _a === void 0 ? void 0 : _a.chromeless;
            newState.layout = PageLayoutType.Standard;
            this.routeChangeHandled = true;
        }
        Object.assign(newState, update);
        // KioskMode overrides chromeless state
        newState.chromeless = newState.kioskMode === KioskMode.Full || ((_b = this.currentRoute) === null || _b === void 0 ? void 0 : _b.chromeless);
        if (!this.ignoreStateUpdate(newState, current)) {
            this.state.next(newState);
        }
    }
    ignoreStateUpdate(newState, current) {
        if (isShallowEqual(newState, current)) {
            return true;
        }
        // Some updates can have new instance of sectionNav or pageNav but with same values
        if (newState.sectionNav !== current.sectionNav || newState.pageNav !== current.pageNav) {
            if (newState.actions === current.actions &&
                newState.layout === current.layout &&
                navItemsAreTheSame(newState.sectionNav.node, current.sectionNav.node) &&
                navItemsAreTheSame(newState.pageNav, current.pageNav)) {
                return true;
            }
        }
        return false;
    }
    useState() {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        return useObservable(this.state, this.state.getValue());
    }
    exitKioskMode() {
        this.update({ kioskMode: undefined });
        locationService.partial({ kiosk: null });
    }
    setKioskModeFromUrl(kiosk) {
        switch (kiosk) {
            case 'tv':
                this.update({ kioskMode: KioskMode.TV });
                break;
            case '1':
            case true:
                this.update({ kioskMode: KioskMode.Full });
        }
    }
    getKioskUrlValue(mode) {
        switch (mode) {
            case KioskMode.TV:
                return 'tv';
            case KioskMode.Full:
                return true;
            default:
                return null;
        }
    }
    getNextKioskMode() {
        const { kioskMode, searchBarHidden } = this.state.getValue();
        if (searchBarHidden || kioskMode === KioskMode.TV) {
            appEvents.emit(AppEvents.alertSuccess, [t('navigation.kiosk.tv-alert', 'Press ESC to exit kiosk mode')]);
            return KioskMode.Full;
        }
        if (!kioskMode) {
            return KioskMode.TV;
        }
        return null;
    }
}
/**
 * Checks if text, url, active child url and parent are the same
 **/
function navItemsAreTheSame(a, b) {
    var _a, _b;
    if (a === b) {
        return true;
    }
    const aActiveChild = (_a = a === null || a === void 0 ? void 0 : a.children) === null || _a === void 0 ? void 0 : _a.find((child) => child.active);
    const bActiveChild = (_b = b === null || b === void 0 ? void 0 : b.children) === null || _b === void 0 ? void 0 : _b.find((child) => child.active);
    return ((a === null || a === void 0 ? void 0 : a.text) === (b === null || b === void 0 ? void 0 : b.text) &&
        (a === null || a === void 0 ? void 0 : a.url) === (b === null || b === void 0 ? void 0 : b.url) &&
        (aActiveChild === null || aActiveChild === void 0 ? void 0 : aActiveChild.url) === (bActiveChild === null || bActiveChild === void 0 ? void 0 : bActiveChild.url) &&
        navItemsAreTheSame(a === null || a === void 0 ? void 0 : a.parentItem, b === null || b === void 0 ? void 0 : b.parentItem));
}
//# sourceMappingURL=AppChromeService.js.map