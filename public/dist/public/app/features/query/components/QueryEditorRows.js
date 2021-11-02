import { __assign, __extends, __read } from "tslib";
// Libraries
import React, { PureComponent } from 'react';
import { QueryEditorRow } from './QueryEditorRow';
import { DragDropContext, Droppable } from 'react-beautiful-dnd';
import { getDataSourceSrv } from '@grafana/runtime';
var QueryEditorRows = /** @class */ (function (_super) {
    __extends(QueryEditorRows, _super);
    function QueryEditorRows() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onRemoveQuery = function (query) {
            _this.props.onQueriesChange(_this.props.queries.filter(function (item) { return item !== query; }));
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
        return _this;
    }
    QueryEditorRows.prototype.onChangeQuery = function (query, index) {
        var _a = this.props, queries = _a.queries, onQueriesChange = _a.onQueriesChange;
        // update query in array
        onQueriesChange(queries.map(function (item, itemIndex) {
            if (itemIndex === index) {
                return query;
            }
            return item;
        }));
    };
    QueryEditorRows.prototype.onDataSourceChange = function (dataSource, index) {
        var _a = this.props, queries = _a.queries, onQueriesChange = _a.onQueriesChange;
        onQueriesChange(queries.map(function (item, itemIndex) {
            if (itemIndex !== index) {
                return item;
            }
            if (item.datasource) {
                var previous = getDataSourceSrv().getInstanceSettings(item.datasource);
                if ((previous === null || previous === void 0 ? void 0 : previous.type) === dataSource.type) {
                    return __assign(__assign({}, item), { datasource: { uid: dataSource.uid } });
                }
            }
            return {
                refId: item.refId,
                hide: item.hide,
                datasource: { uid: dataSource.uid },
            };
        }));
    };
    QueryEditorRows.prototype.render = function () {
        var _this = this;
        var _a = this.props, dsSettings = _a.dsSettings, data = _a.data, queries = _a.queries, app = _a.app, history = _a.history, eventBus = _a.eventBus;
        return (React.createElement(DragDropContext, { onDragEnd: this.onDragEnd },
            React.createElement(Droppable, { droppableId: "transformations-list", direction: "vertical" }, function (provided) {
                return (React.createElement("div", __assign({ ref: provided.innerRef }, provided.droppableProps),
                    queries.map(function (query, index) {
                        var dataSourceSettings = getDataSourceSettings(query, dsSettings);
                        var onChangeDataSourceSettings = dsSettings.meta.mixed
                            ? function (settings) { return _this.onDataSourceChange(settings, index); }
                            : undefined;
                        return (React.createElement(QueryEditorRow, { id: query.refId, index: index, key: query.refId, data: data, query: query, dataSource: dataSourceSettings, onChangeDataSource: onChangeDataSourceSettings, onChange: function (query) { return _this.onChangeQuery(query, index); }, onRemoveQuery: _this.onRemoveQuery, onAddQuery: _this.props.onAddQuery, onRunQuery: _this.props.onRunQueries, queries: queries, app: app, history: history, eventBus: eventBus }));
                    }),
                    provided.placeholder));
            })));
    };
    return QueryEditorRows;
}(PureComponent));
export { QueryEditorRows };
var getDataSourceSettings = function (query, groupSettings) {
    if (!query.datasource) {
        return groupSettings;
    }
    var querySettings = getDataSourceSrv().getInstanceSettings(query.datasource);
    return querySettings || groupSettings;
};
//# sourceMappingURL=QueryEditorRows.js.map