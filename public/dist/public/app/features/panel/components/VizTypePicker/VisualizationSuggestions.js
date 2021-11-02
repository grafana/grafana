import { __assign, __read } from "tslib";
import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { VisualizationPreview } from './VisualizationPreview';
import { getAllSuggestions } from '../../state/getAllSuggestions';
import { useAsync, useLocalStorage } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';
export function VisualizationSuggestions(_a) {
    var onChange = _a.onChange, data = _a.data, panel = _a.panel, searchQuery = _a.searchQuery;
    var styles = useStyles2(getStyles);
    var suggestions = useAsync(function () { return getAllSuggestions(data, panel); }, [data, panel]).value;
    // temp test
    var _b = __read(useLocalStorage("VisualizationSuggestions.showTitle", false), 2), showTitle = _b[0], setShowTitle = _b[1];
    var filteredSuggestions = filterSuggestionsBySearch(searchQuery, suggestions);
    return (React.createElement(AutoSizer, { disableHeight: true, style: { width: '100%', height: '100%' } }, function (_a) {
        var width = _a.width;
        if (!width) {
            return null;
        }
        var columnCount = Math.floor(width / 170);
        var spaceBetween = 8 * (columnCount - 1);
        var previewWidth = (width - spaceBetween) / columnCount;
        return (React.createElement("div", null,
            React.createElement("div", { className: styles.filterRow },
                React.createElement("div", { className: styles.infoText, onClick: function () { return setShowTitle(!showTitle); } }, "Based on current data")),
            React.createElement("div", { className: styles.grid, style: { gridTemplateColumns: "repeat(auto-fill, " + (previewWidth - 1) + "px)" } },
                filteredSuggestions.map(function (suggestion, index) { return (React.createElement(VisualizationPreview, { key: index, data: data, suggestion: suggestion, onChange: onChange, width: previewWidth, showTitle: showTitle })); }),
                searchQuery && filteredSuggestions.length === 0 && (React.createElement("div", { className: styles.infoText }, "No results matched your query")))));
    }));
}
function filterSuggestionsBySearch(searchQuery, suggestions) {
    if (!searchQuery || !suggestions) {
        return suggestions || [];
    }
    var regex = new RegExp(searchQuery, 'i');
    return suggestions.filter(function (s) { return regex.test(s.name) || regex.test(s.pluginId); });
}
var getStyles = function (theme) {
    return {
        heading: css(__assign(__assign({}, theme.typography.h5), { margin: theme.spacing(0, 0.5, 1) })),
        filterRow: css({
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-around',
            alignItems: 'center',
            paddingBottom: '8px',
        }),
        infoText: css({
            fontSize: theme.typography.bodySmall.fontSize,
            color: theme.colors.text.secondary,
            fontStyle: 'italic',
        }),
        grid: css({
            display: 'grid',
            gridGap: theme.spacing(1),
            gridTemplateColumns: 'repeat(auto-fill, 144px)',
            marginBottom: theme.spacing(1),
            justifyContent: 'space-evenly',
        }),
    };
};
//# sourceMappingURL=VisualizationSuggestions.js.map