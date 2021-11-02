import { __assign, __makeTemplateObject } from "tslib";
import React, { useMemo } from 'react';
import { VizTypePickerPlugin } from './VizTypePickerPlugin';
import { EmptySearchResult, useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { filterPluginList, getAllPanelPluginMeta } from '../../state/util';
export function VizTypePicker(_a) {
    var searchQuery = _a.searchQuery, onChange = _a.onChange, current = _a.current, data = _a.data;
    var styles = useStyles2(getStyles);
    var pluginsList = useMemo(function () {
        return getAllPanelPluginMeta();
    }, []);
    var filteredPluginTypes = useMemo(function () {
        return filterPluginList(pluginsList, searchQuery, current);
    }, [current, pluginsList, searchQuery]);
    if (filteredPluginTypes.length === 0) {
        return React.createElement(EmptySearchResult, null, "Could not find anything matching your query");
    }
    return (React.createElement("div", { className: styles.grid }, filteredPluginTypes.map(function (plugin, index) { return (React.createElement(VizTypePickerPlugin, { disabled: false, key: plugin.id, isCurrent: plugin.id === current.id, plugin: plugin, onClick: function (e) {
            return onChange({
                pluginId: plugin.id,
                withModKey: Boolean(e.metaKey || e.ctrlKey || e.altKey),
            });
        } })); })));
}
var getStyles = function (theme) {
    return {
        grid: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      max-width: 100%;\n      display: grid;\n      grid-gap: ", ";\n    "], ["\n      max-width: 100%;\n      display: grid;\n      grid-gap: ", ";\n    "])), theme.spacing(0.5)),
        heading: css(__assign(__assign({}, theme.typography.h5), { margin: theme.spacing(0, 0.5, 1) })),
    };
};
var templateObject_1;
//# sourceMappingURL=VizTypePicker.js.map