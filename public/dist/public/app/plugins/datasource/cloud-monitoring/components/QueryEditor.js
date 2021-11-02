import { __assign, __awaiter, __extends, __generator, __makeTemplateObject, __rest } from "tslib";
import React, { PureComponent } from 'react';
import { css } from '@emotion/css';
import { Button, Select } from '@grafana/ui';
import { MetricQueryEditor, SLOQueryEditor, QueryEditorRow } from './';
import { QueryType, EditorMode } from '../types';
import { SELECT_WIDTH, QUERY_TYPES } from '../constants';
import { defaultQuery } from './MetricQueryEditor';
import { defaultQuery as defaultSLOQuery } from './SLO/SLOQueryEditor';
import { toOption } from '../functions';
var QueryEditor = /** @class */ (function (_super) {
    __extends(QueryEditor, _super);
    function QueryEditor() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    QueryEditor.prototype.UNSAFE_componentWillMount = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, datasource, query, _b, hide, refId, datasource_1, key, queryType, maxLines, metric, metricQuery;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _a = this.props, datasource = _a.datasource, query = _a.query;
                        // Unfortunately, migrations like this need to go UNSAFE_componentWillMount. As soon as there's
                        // migration hook for this module.ts, we can do the migrations there instead.
                        if (!this.props.query.hasOwnProperty('metricQuery')) {
                            _b = this.props.query, hide = _b.hide, refId = _b.refId, datasource_1 = _b.datasource, key = _b.key, queryType = _b.queryType, maxLines = _b.maxLines, metric = _b.metric, metricQuery = __rest(_b, ["hide", "refId", "datasource", "key", "queryType", "maxLines", "metric"]);
                            this.props.query.metricQuery = metricQuery;
                        }
                        if (!this.props.query.hasOwnProperty('queryType')) {
                            this.props.query.queryType = QueryType.METRICS;
                        }
                        return [4 /*yield*/, datasource.ensureGCEDefaultProject()];
                    case 1:
                        _c.sent();
                        if (!query.metricQuery.projectName) {
                            this.props.query.metricQuery.projectName = datasource.getDefaultProject();
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    QueryEditor.prototype.onQueryChange = function (prop, value) {
        var _a;
        this.props.onChange(__assign(__assign({}, this.props.query), (_a = {}, _a[prop] = value, _a)));
        this.props.onRunQuery();
    };
    QueryEditor.prototype.render = function () {
        var _this = this;
        var _a, _b, _c;
        var _d = this.props, datasource = _d.datasource, query = _d.query, onRunQuery = _d.onRunQuery, onChange = _d.onChange;
        var metricQuery = __assign(__assign({}, defaultQuery(datasource)), query.metricQuery);
        var sloQuery = __assign(__assign({}, defaultSLOQuery(datasource)), query.sloQuery);
        var queryType = query.queryType || QueryType.METRICS;
        var meta = ((_a = this.props.data) === null || _a === void 0 ? void 0 : _a.series.length) ? (_b = this.props.data) === null || _b === void 0 ? void 0 : _b.series[0].meta : {};
        var customMetaData = (_c = meta === null || meta === void 0 ? void 0 : meta.custom) !== null && _c !== void 0 ? _c : {};
        var variableOptionGroup = {
            label: 'Template Variables',
            expanded: false,
            options: datasource.getVariables().map(toOption),
        };
        return (React.createElement(React.Fragment, null,
            React.createElement(QueryEditorRow, { label: "Query type", fillComponent: query.queryType !== QueryType.SLO && (React.createElement(Button, { variant: "secondary", className: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n                  margin-left: auto;\n                "], ["\n                  margin-left: auto;\n                "]))), icon: "edit", onClick: function () {
                        return _this.onQueryChange('metricQuery', __assign(__assign({}, metricQuery), { editorMode: metricQuery.editorMode === EditorMode.MQL ? EditorMode.Visual : EditorMode.MQL }));
                    } }, metricQuery.editorMode === EditorMode.MQL ? 'Switch to builder' : 'Edit MQL')) },
                React.createElement(Select, { menuShouldPortal: true, width: SELECT_WIDTH, value: queryType, options: QUERY_TYPES, onChange: function (_a) {
                        var value = _a.value;
                        onChange(__assign(__assign({}, query), { sloQuery: sloQuery, queryType: value }));
                        onRunQuery();
                    } })),
            queryType === QueryType.METRICS && (React.createElement(MetricQueryEditor, { refId: query.refId, variableOptionGroup: variableOptionGroup, customMetaData: customMetaData, onChange: function (metricQuery) {
                    _this.props.onChange(__assign(__assign({}, _this.props.query), { metricQuery: metricQuery }));
                }, onRunQuery: onRunQuery, datasource: datasource, query: metricQuery })),
            queryType === QueryType.SLO && (React.createElement(SLOQueryEditor, { variableOptionGroup: variableOptionGroup, customMetaData: customMetaData, onChange: function (query) { return _this.onQueryChange('sloQuery', query); }, onRunQuery: onRunQuery, datasource: datasource, query: sloQuery }))));
    };
    return QueryEditor;
}(PureComponent));
export { QueryEditor };
var templateObject_1;
//# sourceMappingURL=QueryEditor.js.map