import { __read } from "tslib";
import { PanelChrome } from '@grafana/ui';
import { PanelRenderer } from 'app/features/panel/components/PanelRenderer';
import React, { useEffect, useState } from 'react';
import { usePanelLatestData } from './usePanelLatestData';
import { RefreshEvent } from '@grafana/runtime';
import { applyPanelTimeOverrides } from 'app/features/dashboard/utils/panel';
import { getTimeSrv } from '../../services/TimeSrv';
export function PanelEditorTableView(_a) {
    var width = _a.width, height = _a.height, panel = _a.panel, dashboard = _a.dashboard;
    var data = usePanelLatestData(panel, { withTransforms: true, withFieldConfig: false }, false).data;
    var _b = __read(useState({
        frameIndex: 0,
        showHeader: true,
        showTypeIcons: true,
    }), 2), options = _b[0], setOptions = _b[1];
    // Subscribe to panel event
    useEffect(function () {
        var timeSrv = getTimeSrv();
        var timeData = applyPanelTimeOverrides(panel, timeSrv.timeRange());
        var sub = panel.events.subscribe(RefreshEvent, function () {
            panel.runAllPanelQueries(dashboard.id, dashboard.getTimezone(), timeData, width);
        });
        return function () {
            sub.unsubscribe();
        };
    }, [panel, dashboard, width]);
    if (!data) {
        return null;
    }
    return (React.createElement(PanelChrome, { width: width, height: height, padding: "none" }, function (innerWidth, innerHeight) { return (React.createElement(PanelRenderer, { title: "Raw data", pluginId: "table", width: innerWidth, height: innerHeight, data: data, options: options, onOptionsChange: setOptions })); }));
}
//# sourceMappingURL=PanelEditorTableView.js.map