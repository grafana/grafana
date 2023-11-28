import React from 'react';
import { CoreApp } from '@grafana/data';
import { FlameGraph, checkFields, getMessageCheckFieldsResult } from '@grafana/flamegraph';
import { PanelDataErrorView, reportInteraction, config } from '@grafana/runtime';
function interaction(name, context = {}) {
    reportInteraction(`grafana_flamegraph_${name}`, Object.assign({ app: CoreApp.Unknown, grafana_version: config.buildInfo.version }, context));
}
export const FlameGraphPanel = (props) => {
    const wrongFields = checkFields(props.data.series[0]);
    if (wrongFields) {
        return (React.createElement(PanelDataErrorView, { panelId: props.id, data: props.data, message: getMessageCheckFieldsResult(wrongFields) }));
    }
    return (React.createElement(FlameGraph, { data: props.data.series[0], stickyHeader: false, getTheme: () => config.theme2, onTableSymbolClick: () => interaction('table_item_selected'), onViewSelected: (view) => interaction('view_selected', { view }), onTextAlignSelected: (align) => interaction('text_align_selected', { align }), onTableSort: (sort) => interaction('table_sort_selected', { sort }) }));
};
//# sourceMappingURL=FlameGraphPanel.js.map