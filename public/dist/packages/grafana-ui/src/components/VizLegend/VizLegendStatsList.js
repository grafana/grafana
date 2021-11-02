import { __makeTemplateObject } from "tslib";
import React from 'react';
import { InlineList } from '../List/InlineList';
import { css } from '@emotion/css';
import { formattedValueToString } from '@grafana/data';
import { capitalize } from 'lodash';
import { useStyles } from '../../themes/ThemeContext';
/**
 * @internal
 */
export var VizLegendStatsList = function (_a) {
    var stats = _a.stats;
    var styles = useStyles(getStyles);
    if (stats.length === 0) {
        return null;
    }
    return (React.createElement(InlineList, { className: styles.list, items: stats, renderItem: function (stat) { return (React.createElement("div", { className: styles.item, title: stat.description },
            stat.title && capitalize(stat.title) + ":",
            " ",
            formattedValueToString(stat))); } }));
};
var getStyles = function () { return ({
    list: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    flex-grow: 1;\n    text-align: right;\n  "], ["\n    flex-grow: 1;\n    text-align: right;\n  "]))),
    item: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    margin-left: 8px;\n  "], ["\n    margin-left: 8px;\n  "]))),
}); };
VizLegendStatsList.displayName = 'VizLegendStatsList';
var templateObject_1, templateObject_2;
//# sourceMappingURL=VizLegendStatsList.js.map