import React from 'react';
import { sceneGraph, SceneObjectBase, } from '@grafana/scenes';
import { t } from 'app/core/internationalization';
import { InspectTab } from 'app/features/inspector/types';
import { InspectStatsTab as OldInspectStatsTab } from '../../inspector/InspectStatsTab';
export class InspectStatsTab extends SceneObjectBase {
    getTabLabel() {
        return t('dashboard.inspect.stats-tab', 'Stats');
    }
    getTabValue() {
        return InspectTab.Stats;
    }
}
InspectStatsTab.Component = ({ model }) => {
    const data = sceneGraph.getData(model.state.panelRef.resolve()).useState();
    const timeRange = sceneGraph.getTimeRange(model.state.panelRef.resolve());
    if (!data.data) {
        return null;
    }
    return React.createElement(OldInspectStatsTab, { data: data.data, timeZone: timeRange.getTimeZone() });
};
//# sourceMappingURL=InspectStatsTab.js.map