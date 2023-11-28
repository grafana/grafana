import { __awaiter } from "tslib";
import Mousetrap from 'mousetrap';
import 'mousetrap-global-bind';
import 'mousetrap/plugins/global-bind/mousetrap-global-bind';
import { LegacyGraphHoverClearEvent, locationUtil } from '@grafana/data';
import appEvents from 'app/core/app_events';
import { getExploreUrl } from 'app/core/utils/explore';
import { SaveDashboardDrawer } from 'app/features/dashboard/components/SaveDashboard/SaveDashboardDrawer';
import { ShareModal } from 'app/features/dashboard/components/ShareModal';
import { getTimeSrv } from '../../features/dashboard/services/TimeSrv';
import { RemovePanelEvent, ShiftTimeEvent, ShiftTimeEventDirection, ShowModalReactEvent, ZoomOutEvent, AbsoluteTimeEvent, } from '../../types/events';
import { HelpModal } from '../components/help/HelpModal';
import { contextSrv } from '../core';
import { toggleTheme } from './theme';
import { withFocusedPanel } from './withFocusedPanelId';
export class KeybindingSrv {
    constructor(locationService, chromeService) {
        this.locationService = locationService;
        this.chromeService = chromeService;
    }
    clearAndInitGlobalBindings(route) {
        Mousetrap.reset();
        // Chromeless pages like login and signup page don't get any global bindings
        if (!route.chromeless) {
            this.bind(['?', 'h'], this.showHelpModal);
            this.bind('g h', this.goToHome);
            this.bind('g d', this.goToDashboards);
            this.bind('g e', this.goToExplore);
            this.bind('g a', this.openAlerting);
            this.bind('g p', this.goToProfile);
            this.bind('esc', this.exit);
            this.bindGlobalEsc();
        }
        this.bind('c t', () => toggleTheme(false));
        this.bind('c r', () => toggleTheme(true));
    }
    bindGlobalEsc() {
        this.bindGlobal('esc', this.globalEsc);
    }
    globalEsc() {
        const anyDoc = document;
        const activeElement = anyDoc.activeElement;
        // typehead needs to handle it
        const typeaheads = document.querySelectorAll('.slate-typeahead--open');
        if (typeaheads.length > 0) {
            return;
        }
        // second check if we are in an input we can blur
        if (activeElement && activeElement instanceof HTMLElement) {
            if (activeElement.nodeName === 'INPUT' ||
                activeElement.nodeName === 'TEXTAREA' ||
                activeElement.hasAttribute('data-slate-editor')) {
                activeElement.blur();
                return;
            }
        }
        // ok no focused input or editor that should block this, let exist!
        this.exit();
    }
    closeSearch() {
        this.locationService.partial({ search: null });
    }
    openAlerting() {
        this.locationService.push('/alerting');
    }
    goToDashboards() {
        this.locationService.push('/dashboards');
    }
    goToHome() {
        this.locationService.push('/');
    }
    goToProfile() {
        this.locationService.push('/profile');
    }
    goToExplore() {
        this.locationService.push('/explore');
    }
    showHelpModal() {
        appEvents.publish(new ShowModalReactEvent({ component: HelpModal }));
    }
    exit() {
        const search = this.locationService.getSearchObject();
        if (search.editview) {
            this.locationService.partial({ editview: null, editIndex: null });
            return;
        }
        if (search.inspect) {
            this.locationService.partial({ inspect: null, inspectTab: null });
            return;
        }
        if (search.editPanel) {
            this.locationService.partial({ editPanel: null, tab: null });
            return;
        }
        if (search.viewPanel) {
            this.locationService.partial({ viewPanel: null, tab: null });
            return;
        }
        const { kioskMode } = this.chromeService.state.getValue();
        if (kioskMode) {
            this.chromeService.exitKioskMode();
        }
        if (search.search) {
            this.closeSearch();
        }
    }
    showDashEditView() {
        this.locationService.partial({
            editview: 'settings',
        });
    }
    bind(keyArg, fn) {
        Mousetrap.bind(keyArg, (evt) => {
            evt.preventDefault();
            evt.stopPropagation();
            evt.returnValue = false;
            fn.call(this);
        }, 'keydown');
    }
    bindGlobal(keyArg, fn) {
        Mousetrap.bindGlobal(keyArg, (evt) => {
            evt.preventDefault();
            evt.stopPropagation();
            evt.returnValue = false;
            fn.call(this);
        }, 'keydown');
    }
    unbind(keyArg, keyType) {
        Mousetrap.unbind(keyArg, keyType);
    }
    bindWithPanelId(keyArg, fn) {
        this.bind(keyArg, withFocusedPanel(fn));
    }
    setupTimeRangeBindings(updateUrl = true) {
        this.bind('t a', () => {
            appEvents.publish(new AbsoluteTimeEvent({ updateUrl }));
        });
        this.bind('t z', () => {
            appEvents.publish(new ZoomOutEvent({ scale: 2, updateUrl }));
        });
        this.bind('ctrl+z', () => {
            appEvents.publish(new ZoomOutEvent({ scale: 2, updateUrl }));
        });
        this.bind('t left', () => {
            appEvents.publish(new ShiftTimeEvent({ direction: ShiftTimeEventDirection.Left, updateUrl }));
        });
        this.bind('t right', () => {
            appEvents.publish(new ShiftTimeEvent({ direction: ShiftTimeEventDirection.Right, updateUrl }));
        });
    }
    setupDashboardBindings(dashboard) {
        this.bind('mod+o', () => {
            dashboard.graphTooltip = (dashboard.graphTooltip + 1) % 3;
            dashboard.events.publish(new LegacyGraphHoverClearEvent());
            dashboard.startRefresh();
        });
        this.bind('mod+s', () => {
            if (dashboard.meta.canSave) {
                appEvents.publish(new ShowModalReactEvent({
                    component: SaveDashboardDrawer,
                    props: {
                        dashboard,
                    },
                }));
            }
        });
        this.setupTimeRangeBindings();
        // edit panel
        this.bindWithPanelId('e', (panelId) => {
            if (dashboard.canEditPanelById(panelId)) {
                const isEditing = this.locationService.getSearchObject().editPanel !== undefined;
                this.locationService.partial({ editPanel: isEditing ? null : panelId });
            }
        });
        // view panel
        this.bindWithPanelId('v', (panelId) => {
            const isViewing = this.locationService.getSearchObject().viewPanel !== undefined;
            this.locationService.partial({ viewPanel: isViewing ? null : panelId });
        });
        //toggle legend
        this.bindWithPanelId('p l', (panelId) => {
            const panel = dashboard.getPanelById(panelId);
            const newOptions = Object.assign({}, panel.options);
            newOptions.legend.showLegend ? (newOptions.legend.showLegend = false) : (newOptions.legend.showLegend = true);
            panel.updateOptions(newOptions);
        });
        this.bindWithPanelId('i', (panelId) => {
            this.locationService.partial({ inspect: panelId });
        });
        // jump to explore if permissions allow
        if (contextSrv.hasAccessToExplore()) {
            this.bindWithPanelId('p x', (panelId) => __awaiter(this, void 0, void 0, function* () {
                const panel = dashboard.getPanelById(panelId);
                const url = yield getExploreUrl({
                    queries: panel.targets,
                    dsRef: panel.datasource,
                    scopedVars: panel.scopedVars,
                    timeRange: getTimeSrv().timeRange(),
                });
                if (url) {
                    const urlWithoutBase = locationUtil.stripBaseFromUrl(url);
                    if (urlWithoutBase) {
                        this.locationService.push(urlWithoutBase);
                    }
                }
            }));
        }
        // delete panel
        this.bindWithPanelId('p r', (panelId) => {
            if (dashboard.canEditPanelById(panelId) && !(dashboard.panelInView || dashboard.panelInEdit)) {
                appEvents.publish(new RemovePanelEvent(panelId));
            }
        });
        // duplicate panel
        this.bindWithPanelId('p d', (panelId) => {
            if (dashboard.canEditPanelById(panelId)) {
                const panelIndex = dashboard.getPanelInfoById(panelId).index;
                dashboard.duplicatePanel(dashboard.panels[panelIndex]);
            }
        });
        // share panel
        this.bindWithPanelId('p s', (panelId) => {
            const panelInfo = dashboard.getPanelInfoById(panelId);
            appEvents.publish(new ShowModalReactEvent({
                component: ShareModal,
                props: {
                    dashboard: dashboard,
                    panel: panelInfo === null || panelInfo === void 0 ? void 0 : panelInfo.panel,
                },
            }));
        });
        // toggle panel legend
        // toggle all panel legends
        this.bind('d l', () => {
            dashboard.toggleLegendsForAll();
        });
        // toggle all exemplars
        this.bind('d x', () => {
            dashboard.toggleExemplarsForAll();
        });
        // collapse all rows
        this.bind('d shift+c', () => {
            dashboard.collapseRows();
        });
        // expand all rows
        this.bind('d shift+e', () => {
            dashboard.expandRows();
        });
        this.bind('d n', () => {
            this.locationService.push('/dashboard/new');
        });
        this.bind('d r', () => {
            dashboard.startRefresh();
        });
        this.bind('d s', () => {
            this.showDashEditView();
        });
        this.bind('d k', () => {
            this.chromeService.onToggleKioskMode();
        });
        //Autofit panels
        this.bind('d a', () => {
            // this has to be a full page reload
            const queryParams = this.locationService.getSearchObject();
            const newUrlParam = queryParams.autofitpanels ? '' : '&autofitpanels';
            window.location.href = window.location.href + newUrlParam;
        });
    }
}
//# sourceMappingURL=keybindingSrv.js.map