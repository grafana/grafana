import React, { PureComponent } from 'react';
import { DragDropContext, Droppable } from 'react-beautiful-dnd';
import { getDataSourceSrv, reportInteraction } from '@grafana/runtime';
import { QueryEditorRow } from './QueryEditorRow';
export class QueryEditorRows extends PureComponent {
    constructor() {
        super(...arguments);
        this.onRemoveQuery = (query) => {
            this.props.onQueriesChange(this.props.queries.filter((item) => item !== query));
        };
        this.onDragStart = (result) => {
            const { queries, dsSettings } = this.props;
            reportInteraction('query_row_reorder_started', {
                startIndex: result.source.index,
                numberOfQueries: queries.length,
                datasourceType: dsSettings.type,
            });
        };
        this.onDragEnd = (result) => {
            const { queries, onQueriesChange, dsSettings } = this.props;
            if (!result || !result.destination) {
                return;
            }
            const startIndex = result.source.index;
            const endIndex = result.destination.index;
            if (startIndex === endIndex) {
                reportInteraction('query_row_reorder_canceled', {
                    startIndex,
                    endIndex,
                    numberOfQueries: queries.length,
                    datasourceType: dsSettings.type,
                });
                return;
            }
            const update = Array.from(queries);
            const [removed] = update.splice(startIndex, 1);
            update.splice(endIndex, 0, removed);
            onQueriesChange(update);
            reportInteraction('query_row_reorder_ended', {
                startIndex,
                endIndex,
                numberOfQueries: queries.length,
                datasourceType: dsSettings.type,
            });
        };
    }
    onChangeQuery(query, index) {
        const { queries, onQueriesChange } = this.props;
        // update query in array
        onQueriesChange(queries.map((item, itemIndex) => {
            if (itemIndex === index) {
                return query;
            }
            return item;
        }));
    }
    onDataSourceChange(dataSource, index) {
        const { queries, onQueriesChange } = this.props;
        onQueriesChange(queries.map((item, itemIndex) => {
            if (itemIndex !== index) {
                return item;
            }
            const dataSourceRef = {
                type: dataSource.type,
                uid: dataSource.uid,
            };
            if (item.datasource) {
                const previous = getDataSourceSrv().getInstanceSettings(item.datasource);
                if ((previous === null || previous === void 0 ? void 0 : previous.type) === dataSource.type) {
                    return Object.assign(Object.assign({}, item), { datasource: dataSourceRef });
                }
            }
            return {
                refId: item.refId,
                hide: item.hide,
                datasource: dataSourceRef,
            };
        }));
    }
    render() {
        const { dsSettings, data, queries, app, history, eventBus, onAddQuery, onRunQueries, onQueryCopied, onQueryRemoved, onQueryToggled, } = this.props;
        return (React.createElement(DragDropContext, { onDragStart: this.onDragStart, onDragEnd: this.onDragEnd },
            React.createElement(Droppable, { droppableId: "transformations-list", direction: "vertical" }, (provided) => {
                return (React.createElement("div", Object.assign({ "data-testid": "query-editor-rows", ref: provided.innerRef }, provided.droppableProps),
                    queries.map((query, index) => {
                        const dataSourceSettings = getDataSourceSettings(query, dsSettings);
                        const onChangeDataSourceSettings = dsSettings.meta.mixed
                            ? (settings) => this.onDataSourceChange(settings, index)
                            : undefined;
                        return (React.createElement(QueryEditorRow, { id: query.refId, index: index, key: query.refId, data: data, query: query, dataSource: dataSourceSettings, onChangeDataSource: onChangeDataSourceSettings, onChange: (query) => this.onChangeQuery(query, index), onRemoveQuery: this.onRemoveQuery, onAddQuery: onAddQuery, onRunQuery: onRunQueries, onQueryCopied: onQueryCopied, onQueryRemoved: onQueryRemoved, onQueryToggled: onQueryToggled, queries: queries, app: app, history: history, eventBus: eventBus }));
                    }),
                    provided.placeholder));
            })));
    }
}
const getDataSourceSettings = (query, groupSettings) => {
    if (!query.datasource) {
        return groupSettings;
    }
    const querySettings = getDataSourceSrv().getInstanceSettings(query.datasource);
    return querySettings || groupSettings;
};
//# sourceMappingURL=QueryEditorRows.js.map