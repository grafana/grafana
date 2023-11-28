import React, { useEffect, useState } from 'react';
import { RefreshEvent } from '@grafana/runtime';
import { PanelChrome } from '@grafana/ui';
import { applyPanelTimeOverrides } from 'app/features/dashboard/utils/panel';
import { PanelRenderer } from 'app/features/panel/components/PanelRenderer';
import { getTimeSrv } from '../../services/TimeSrv';
import PanelHeaderCorner from './PanelHeaderCorner';
import { usePanelLatestData } from './usePanelLatestData';
export function PanelEditorTableView({ width, height, panel, dashboard }) {
    var _a;
    const { data } = usePanelLatestData(panel, { withTransforms: true, withFieldConfig: false }, false);
    const [options, setOptions] = useState({
        frameIndex: 0,
        showHeader: true,
        showTypeIcons: true,
    });
    // Subscribe to panel event
    useEffect(() => {
        const timeSrv = getTimeSrv();
        const sub = panel.events.subscribe(RefreshEvent, () => {
            const timeData = applyPanelTimeOverrides(panel, timeSrv.timeRange());
            panel.runAllPanelQueries({
                dashboardUID: dashboard.uid,
                dashboardTimezone: dashboard.getTimezone(),
                timeData,
                width,
            });
        });
        return () => {
            sub.unsubscribe();
        };
    }, [panel, dashboard, width]);
    if (!data) {
        return null;
    }
    const errorMessage = (data === null || data === void 0 ? void 0 : data.errors)
        ? data.errors.length > 1
            ? 'Multiple errors found. Click for more details'
            : data.errors[0].message
        : (_a = data === null || data === void 0 ? void 0 : data.error) === null || _a === void 0 ? void 0 : _a.message;
    return (React.createElement(PanelChrome, { width: width, height: height, padding: "none" }, (innerWidth, innerHeight) => (React.createElement(React.Fragment, null,
        React.createElement(PanelHeaderCorner, { panel: panel, error: errorMessage }),
        React.createElement(PanelRenderer, { title: "Raw data", pluginId: "table", width: innerWidth, height: innerHeight, data: data, options: options, onOptionsChange: setOptions })))));
}
//# sourceMappingURL=PanelEditorTableView.js.map