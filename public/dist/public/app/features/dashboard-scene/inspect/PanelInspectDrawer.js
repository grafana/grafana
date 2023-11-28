import { __awaiter } from "tslib";
import React from 'react';
import { useLocation } from 'react-router-dom';
import { locationUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { SceneObjectBase, sceneGraph, } from '@grafana/scenes';
import { Alert, Drawer, Tab, TabsBar } from '@grafana/ui';
import { getDataSourceWithInspector } from 'app/features/dashboard/components/Inspector/hooks';
import { supportsDataQuery } from 'app/features/dashboard/components/PanelEditor/utils';
import { InspectDataTab } from './InspectDataTab';
import { InspectJsonTab } from './InspectJsonTab';
import { InspectMetaDataTab } from './InspectMetaDataTab';
import { InspectQueryTab } from './InspectQueryTab';
import { InspectStatsTab } from './InspectStatsTab';
export class PanelInspectDrawer extends SceneObjectBase {
    constructor(state) {
        super(state);
        this.onClose = () => {
            locationService.partial({ inspect: null, inspectTab: null });
        };
        this.addActivationHandler(() => this._activationHandler());
    }
    _activationHandler() {
        this.buildTabs(0);
    }
    /**
     * We currently have no async await to get the panel plugin from the VizPanel.
     * That is why there is a retry argument here and a setTimeout, to try again a bit later.
     */
    buildTabs(retry) {
        return __awaiter(this, void 0, void 0, function* () {
            const panelRef = this.state.panelRef;
            const panel = panelRef.resolve();
            const plugin = panel.getPlugin();
            const tabs = [];
            if (!plugin) {
                if (retry < 2000) {
                    setTimeout(() => this.buildTabs(retry + 100), 100);
                }
                else {
                    this.setState({ pluginNotLoaded: true });
                }
            }
            if (supportsDataQuery(plugin)) {
                const data = sceneGraph.getData(panel);
                tabs.push(new InspectDataTab({ panelRef }));
                tabs.push(new InspectStatsTab({ panelRef }));
                tabs.push(new InspectQueryTab({ panelRef }));
                const dsWithInspector = yield getDataSourceWithInspector(data.state.data);
                if (dsWithInspector) {
                    tabs.push(new InspectMetaDataTab({ panelRef, dataSource: dsWithInspector }));
                }
            }
            tabs.push(new InspectJsonTab({ panelRef, onClose: this.onClose }));
            this.setState({ tabs });
        });
    }
    getDrawerTitle() {
        const panel = this.state.panelRef.resolve();
        return sceneGraph.interpolate(panel, `Inspect: ${panel.state.title}`);
    }
}
PanelInspectDrawer.Component = PanelInspectRenderer;
function PanelInspectRenderer({ model }) {
    var _a;
    const { tabs, pluginNotLoaded } = model.useState();
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    if (!tabs) {
        return null;
    }
    const urlTab = queryParams.get('inspectTab');
    const currentTab = (_a = tabs.find((tab) => tab.getTabValue() === urlTab)) !== null && _a !== void 0 ? _a : tabs[0];
    return (React.createElement(Drawer, { title: model.getDrawerTitle(), onClose: model.onClose, size: "md", tabs: React.createElement(TabsBar, null, tabs.map((tab) => {
            return (React.createElement(Tab, { key: tab.state.key, label: tab.getTabLabel(), active: tab === currentTab, href: locationUtil.getUrlForPartial(location, { inspectTab: tab.getTabValue() }) }));
        })) },
        pluginNotLoaded && (React.createElement(Alert, { title: "Panel plugin not loaded" }, "Make sure the panel you want to inspect is visible and has been displayed before opening inspect.")),
        currentTab && currentTab.Component && React.createElement(currentTab.Component, { model: currentTab })));
}
//# sourceMappingURL=PanelInspectDrawer.js.map