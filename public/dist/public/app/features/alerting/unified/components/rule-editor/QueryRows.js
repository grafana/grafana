import { __assign, __extends, __read, __values } from "tslib";
import React, { PureComponent } from 'react';
import { DragDropContext, Droppable } from 'react-beautiful-dnd';
import { LoadingState, ThresholdsMode, } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { QueryWrapper } from './QueryWrapper';
import { isExpressionQuery } from 'app/features/expressions/guards';
var QueryRows = /** @class */ (function (_super) {
    __extends(QueryRows, _super);
    function QueryRows(props) {
        var _this = _super.call(this, props) || this;
        _this.onRemoveQuery = function (query) {
            _this.props.onQueriesChange(_this.props.queries.filter(function (item) {
                return item.model.refId !== query.refId;
            }));
        };
        _this.onChangeTimeRange = function (timeRange, index) {
            var _a = _this.props, queries = _a.queries, onQueriesChange = _a.onQueriesChange;
            onQueriesChange(queries.map(function (item, itemIndex) {
                if (itemIndex !== index) {
                    return item;
                }
                return __assign(__assign({}, item), { relativeTimeRange: timeRange });
            }));
        };
        _this.onChangeThreshold = function (thresholds, index) {
            var _a = _this.props, queries = _a.queries, onQueriesChange = _a.onQueriesChange;
            var referencedRefId = queries[index].refId;
            onQueriesChange(queries.map(function (query) {
                if (!isExpressionQuery(query.model)) {
                    return query;
                }
                if (query.model.conditions && query.model.conditions[0].query.params[0] === referencedRefId) {
                    return __assign(__assign({}, query), { model: __assign(__assign({}, query.model), { conditions: query.model.conditions.map(function (condition, conditionIndex) {
                                // Only update the first condition for a given refId.
                                if (condition.query.params[0] === referencedRefId && conditionIndex === 0) {
                                    return __assign(__assign({}, condition), { evaluator: __assign(__assign({}, condition.evaluator), { params: [parseFloat(thresholds.steps[1].value.toPrecision(3))] }) });
                                }
                                return condition;
                            }) }) });
                }
                return query;
            }));
        };
        _this.onChangeDataSource = function (settings, index) {
            var _a = _this.props, queries = _a.queries, onQueriesChange = _a.onQueriesChange;
            onQueriesChange(queries.map(function (item, itemIndex) {
                if (itemIndex !== index) {
                    return item;
                }
                var previous = getDataSourceSrv().getInstanceSettings(item.datasourceUid);
                if ((previous === null || previous === void 0 ? void 0 : previous.type) === settings.uid) {
                    return __assign(__assign({}, item), { datasourceUid: settings.uid });
                }
                var _a = item.model, refId = _a.refId, hide = _a.hide;
                return __assign(__assign({}, item), { datasourceUid: settings.uid, model: { refId: refId, hide: hide } });
            }));
        };
        _this.onChangeQuery = function (query, index) {
            var _a = _this.props, queries = _a.queries, onQueriesChange = _a.onQueriesChange;
            onQueriesChange(queries.map(function (item, itemIndex) {
                if (itemIndex !== index) {
                    return item;
                }
                return __assign(__assign({}, item), { refId: query.refId, model: __assign(__assign(__assign({}, item.model), query), { datasource: query.datasource }) });
            }));
        };
        _this.onDragEnd = function (result) {
            var _a = _this.props, queries = _a.queries, onQueriesChange = _a.onQueriesChange;
            if (!result || !result.destination) {
                return;
            }
            var startIndex = result.source.index;
            var endIndex = result.destination.index;
            if (startIndex === endIndex) {
                return;
            }
            var update = Array.from(queries);
            var _b = __read(update.splice(startIndex, 1), 1), removed = _b[0];
            update.splice(endIndex, 0, removed);
            onQueriesChange(update);
        };
        _this.onDuplicateQuery = function (query, source) {
            _this.props.onDuplicateQuery(__assign(__assign({}, source), { model: query }));
        };
        _this.getDataSourceSettings = function (query) {
            return getDataSourceSrv().getInstanceSettings(query.datasourceUid);
        };
        _this.getThresholdsForQueries = function (queries) {
            var e_1, _a;
            var record = {};
            try {
                for (var queries_1 = __values(queries), queries_1_1 = queries_1.next(); !queries_1_1.done; queries_1_1 = queries_1.next()) {
                    var query = queries_1_1.value;
                    if (!isExpressionQuery(query.model)) {
                        continue;
                    }
                    if (!Array.isArray(query.model.conditions)) {
                        continue;
                    }
                    query.model.conditions.forEach(function (condition, index) {
                        if (index > 0) {
                            return;
                        }
                        var threshold = condition.evaluator.params[0];
                        var refId = condition.query.params[0];
                        if (condition.evaluator.type === 'outside_range' || condition.evaluator.type === 'within_range') {
                            return;
                        }
                        if (!record[refId]) {
                            record[refId] = {
                                mode: ThresholdsMode.Absolute,
                                steps: [
                                    {
                                        value: -Infinity,
                                        color: 'green',
                                    },
                                ],
                            };
                        }
                        record[refId].steps.push({
                            value: threshold,
                            color: 'red',
                        });
                    });
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (queries_1_1 && !queries_1_1.done && (_a = queries_1.return)) _a.call(queries_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            return record;
        };
        _this.state = { dataPerQuery: {} };
        return _this;
    }
    QueryRows.prototype.render = function () {
        var _this = this;
        var _a = this.props, onDuplicateQuery = _a.onDuplicateQuery, onRunQueries = _a.onRunQueries, queries = _a.queries;
        var thresholdByRefId = this.getThresholdsForQueries(queries);
        return (React.createElement(DragDropContext, { onDragEnd: this.onDragEnd },
            React.createElement(Droppable, { droppableId: "alerting-queries", direction: "vertical" }, function (provided) {
                return (React.createElement("div", __assign({ ref: provided.innerRef }, provided.droppableProps),
                    queries.map(function (query, index) {
                        var _a, _b;
                        var data = (_b = (_a = _this.props.data) === null || _a === void 0 ? void 0 : _a[query.refId]) !== null && _b !== void 0 ? _b : {
                            series: [],
                            state: LoadingState.NotStarted,
                        };
                        var dsSettings = _this.getDataSourceSettings(query);
                        if (!dsSettings) {
                            return null;
                        }
                        return (React.createElement(QueryWrapper, { index: index, key: query.refId + "-" + index, dsSettings: dsSettings, data: data, query: query, onChangeQuery: _this.onChangeQuery, onRemoveQuery: _this.onRemoveQuery, queries: queries, onChangeDataSource: _this.onChangeDataSource, onDuplicateQuery: onDuplicateQuery, onRunQueries: onRunQueries, onChangeTimeRange: _this.onChangeTimeRange, thresholds: thresholdByRefId[query.refId], onChangeThreshold: _this.onChangeThreshold }));
                    }),
                    provided.placeholder));
            })));
    };
    return QueryRows;
}(PureComponent));
export { QueryRows };
//# sourceMappingURL=QueryRows.js.map