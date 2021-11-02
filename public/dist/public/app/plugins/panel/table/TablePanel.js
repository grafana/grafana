import { __assign, __extends, __makeTemplateObject } from "tslib";
import React, { Component } from 'react';
import { Select, Table } from '@grafana/ui';
import { FieldMatcherID, getFrameDisplayName } from '@grafana/data';
import { css } from '@emotion/css';
import { config } from 'app/core/config';
import { dispatch } from '../../../store/store';
import { applyFilterFromTable } from '../../../features/variables/adhoc/actions';
import { getDashboardSrv } from '../../../features/dashboard/services/DashboardSrv';
import { getFooterCells } from './footer';
var TablePanel = /** @class */ (function (_super) {
    __extends(TablePanel, _super);
    function TablePanel(props) {
        var _this = _super.call(this, props) || this;
        _this.onColumnResize = function (fieldDisplayName, width) {
            var fieldConfig = _this.props.fieldConfig;
            var overrides = fieldConfig.overrides;
            var matcherId = FieldMatcherID.byName;
            var propId = 'custom.width';
            // look for existing override
            var override = overrides.find(function (o) { return o.matcher.id === matcherId && o.matcher.options === fieldDisplayName; });
            if (override) {
                // look for existing property
                var property = override.properties.find(function (prop) { return prop.id === propId; });
                if (property) {
                    property.value = width;
                }
                else {
                    override.properties.push({ id: propId, value: width });
                }
            }
            else {
                overrides.push({
                    matcher: { id: matcherId, options: fieldDisplayName },
                    properties: [{ id: propId, value: width }],
                });
            }
            _this.props.onFieldConfigChange(__assign(__assign({}, fieldConfig), { overrides: overrides }));
        };
        _this.onSortByChange = function (sortBy) {
            _this.props.onOptionsChange(__assign(__assign({}, _this.props.options), { sortBy: sortBy }));
        };
        _this.onChangeTableSelection = function (val) {
            _this.props.onOptionsChange(__assign(__assign({}, _this.props.options), { frameIndex: val.value || 0 }));
            // Force a redraw -- but no need to re-query
            _this.forceUpdate();
        };
        _this.onCellFilterAdded = function (filter) {
            var _a;
            var key = filter.key, value = filter.value, operator = filter.operator;
            var panelModel = (_a = getDashboardSrv().getCurrent()) === null || _a === void 0 ? void 0 : _a.getPanelById(_this.props.id);
            var datasource = panelModel === null || panelModel === void 0 ? void 0 : panelModel.datasource;
            if (!datasource) {
                return;
            }
            dispatch(applyFilterFromTable({ datasource: datasource, key: key, operator: operator, value: value }));
        };
        return _this;
    }
    TablePanel.prototype.renderTable = function (frame, width, height) {
        var _a;
        var options = this.props.options;
        var footerValues = ((_a = options.footer) === null || _a === void 0 ? void 0 : _a.show) ? getFooterCells(frame, options.footer) : undefined;
        return (React.createElement(Table, { height: height, width: width, data: frame, noHeader: !options.showHeader, showTypeIcons: options.showTypeIcons, resizable: true, initialSortBy: options.sortBy, onSortByChange: this.onSortByChange, onColumnResize: this.onColumnResize, onCellFilterAdded: this.onCellFilterAdded, footerValues: footerValues }));
    };
    TablePanel.prototype.getCurrentFrameIndex = function (frames, options) {
        return options.frameIndex > 0 && options.frameIndex < frames.length ? options.frameIndex : 0;
    };
    TablePanel.prototype.render = function () {
        var _a;
        var _b = this.props, data = _b.data, height = _b.height, width = _b.width, options = _b.options;
        var frames = data.series;
        var count = frames === null || frames === void 0 ? void 0 : frames.length;
        var hasFields = (_a = frames[0]) === null || _a === void 0 ? void 0 : _a.fields.length;
        if (!count || !hasFields) {
            return React.createElement("div", { className: tableStyles.noData }, "No data");
        }
        if (count > 1) {
            var inputHeight = config.theme.spacing.formInputHeight;
            var padding = 8 * 2;
            var currentIndex = this.getCurrentFrameIndex(frames, options);
            var names = frames.map(function (frame, index) {
                return {
                    label: getFrameDisplayName(frame),
                    value: index,
                };
            });
            return (React.createElement("div", { className: tableStyles.wrapper },
                this.renderTable(data.series[currentIndex], width, height - inputHeight - padding),
                React.createElement("div", { className: tableStyles.selectWrapper },
                    React.createElement(Select, { menuShouldPortal: true, options: names, value: names[currentIndex], onChange: this.onChangeTableSelection }))));
        }
        return this.renderTable(data.series[0], width, height - 12);
    };
    return TablePanel;
}(Component));
export { TablePanel };
var tableStyles = {
    wrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    display: flex;\n    flex-direction: column;\n    justify-content: space-between;\n    height: 100%;\n  "], ["\n    display: flex;\n    flex-direction: column;\n    justify-content: space-between;\n    height: 100%;\n  "]))),
    noData: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    display: flex;\n    flex-direction: column;\n    align-items: center;\n    justify-content: center;\n    height: 100%;\n  "], ["\n    display: flex;\n    flex-direction: column;\n    align-items: center;\n    justify-content: center;\n    height: 100%;\n  "]))),
    selectWrapper: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    padding: 8px;\n  "], ["\n    padding: 8px;\n  "]))),
};
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=TablePanel.js.map