import { __read } from "tslib";
import React, { useState } from 'react';
import { connect } from 'react-redux';
import { locationService } from '@grafana/runtime';
import { usePanelLatestData } from '../PanelEditor/usePanelLatestData';
import { InspectContent } from './InspectContent';
import { useDatasourceMetadata, useInspectTabs } from './hooks';
import { useLocation } from 'react-router-dom';
import { getPanelStateForModel } from 'app/features/panel/state/selectors';
var PanelInspectorUnconnected = function (_a) {
    var panel = _a.panel, dashboard = _a.dashboard, plugin = _a.plugin;
    var _b = __read(useState({
        withTransforms: false,
        withFieldConfig: true,
    }), 2), dataOptions = _b[0], setDataOptions = _b[1];
    var location = useLocation();
    var _c = usePanelLatestData(panel, dataOptions, true), data = _c.data, isLoading = _c.isLoading, error = _c.error;
    var metaDs = useDatasourceMetadata(data);
    var tabs = useInspectTabs(panel, dashboard, plugin, error, metaDs);
    var defaultTab = new URLSearchParams(location.search).get('inspectTab');
    var onClose = function () {
        locationService.partial({
            inspect: null,
            inspectTab: null,
        });
    };
    if (!plugin) {
        return null;
    }
    return (React.createElement(InspectContent, { dashboard: dashboard, panel: panel, plugin: plugin, defaultTab: defaultTab, tabs: tabs, data: data, isDataLoading: isLoading, dataOptions: dataOptions, onDataOptionsChange: setDataOptions, metadataDatasource: metaDs, onClose: onClose }));
};
var mapStateToProps = function (state, props) {
    var panelState = getPanelStateForModel(state, props.panel);
    if (!panelState) {
        return { plugin: null };
    }
    return {
        plugin: panelState.plugin,
    };
};
export var PanelInspector = connect(mapStateToProps)(PanelInspectorUnconnected);
//# sourceMappingURL=PanelInspector.js.map