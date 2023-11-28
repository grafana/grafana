import { omit } from 'lodash';
import React, { PureComponent, useState } from 'react';
import { DragDropContext, Droppable } from 'react-beautiful-dnd';
import { LoadingState, rangeUtil, } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { getDataSourceSrv } from '@grafana/runtime';
import { Button, Card, Icon } from '@grafana/ui';
import { QueryOperationRow } from 'app/core/components/QueryOperationRow/QueryOperationRow';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { EmptyQueryWrapper, QueryWrapper } from './QueryWrapper';
import { errorFromCurrentCondition, errorFromPreviewData, getThresholdsForQueries } from './util';
export class QueryRows extends PureComponent {
    constructor(props) {
        super(props);
        this.onRemoveQuery = (query) => {
            const { queries, onQueriesChange } = this.props;
            onQueriesChange(queries.filter((q) => q.refId !== query.refId));
        };
        this.onChangeTimeRange = (timeRange, index) => {
            const { queries, onQueriesChange } = this.props;
            onQueriesChange(queries.map((item, itemIndex) => {
                if (itemIndex !== index) {
                    return item;
                }
                return Object.assign(Object.assign({}, item), { relativeTimeRange: timeRange });
            }));
        };
        this.onChangeQueryOptions = (options, index) => {
            const { queries, onQueriesChange } = this.props;
            onQueriesChange(queries.map((item, itemIndex) => {
                if (itemIndex !== index) {
                    return item;
                }
                return Object.assign(Object.assign({}, item), { model: Object.assign(Object.assign({}, item.model), { maxDataPoints: options.maxDataPoints, intervalMs: options.minInterval ? rangeUtil.intervalToMs(options.minInterval) : undefined }) });
            }));
        };
        this.onChangeDataSource = (settings, index) => {
            const { queries, onQueriesChange } = this.props;
            const updatedQueries = queries.map((item, itemIndex) => {
                if (itemIndex !== index) {
                    return item;
                }
                const previousSettings = this.getDataSourceSettings(item);
                // Copy model if changing to a datasource of same type.
                if (settings.type === (previousSettings === null || previousSettings === void 0 ? void 0 : previousSettings.type)) {
                    return copyModel(item, settings);
                }
                return newModel(item, settings);
            });
            onQueriesChange(updatedQueries);
        };
        this.onChangeQuery = (query, index) => {
            const { queries, onQueriesChange } = this.props;
            onQueriesChange(queries.map((item, itemIndex) => {
                var _a;
                if (itemIndex !== index) {
                    return item;
                }
                return Object.assign(Object.assign({}, item), { refId: query.refId, queryType: (_a = item.model.queryType) !== null && _a !== void 0 ? _a : '', model: Object.assign(Object.assign(Object.assign({}, item.model), query), { datasource: query.datasource }) });
            }));
        };
        this.onDragEnd = (result) => {
            const { queries, onQueriesChange } = this.props;
            if (!result || !result.destination) {
                return;
            }
            const startIndex = result.source.index;
            const endIndex = result.destination.index;
            if (startIndex === endIndex) {
                return;
            }
            const update = Array.from(queries);
            const [removed] = update.splice(startIndex, 1);
            update.splice(endIndex, 0, removed);
            onQueriesChange(update);
        };
        this.getDataSourceSettings = (query) => {
            return getDataSourceSrv().getInstanceSettings(query.datasourceUid);
        };
    }
    render() {
        const { queries, expressions } = this.props;
        const thresholdByRefId = getThresholdsForQueries([...queries, ...expressions]);
        return (React.createElement(DragDropContext, { onDragEnd: this.onDragEnd },
            React.createElement(Droppable, { droppableId: "alerting-queries", direction: "vertical" }, (provided) => {
                return (React.createElement("div", Object.assign({ ref: provided.innerRef }, provided.droppableProps),
                    React.createElement(Stack, { direction: "column" },
                        queries.map((query, index) => {
                            var _a, _b, _c, _d;
                            const isCondition = this.props.condition === query.refId;
                            const data = (_b = (_a = this.props.data) === null || _a === void 0 ? void 0 : _a[query.refId]) !== null && _b !== void 0 ? _b : {
                                series: [],
                                state: LoadingState.NotStarted,
                            };
                            const dsSettings = this.getDataSourceSettings(query);
                            let error = undefined;
                            if (data && isCondition) {
                                error = errorFromCurrentCondition(data);
                            }
                            else if (data) {
                                error = errorFromPreviewData(data);
                            }
                            if (!dsSettings) {
                                return (React.createElement(DatasourceNotFound, { key: `${query.refId}-${index}`, index: index, model: query.model, onUpdateDatasource: () => {
                                        const defaultDataSource = getDatasourceSrv().getInstanceSettings(null);
                                        if (defaultDataSource) {
                                            this.onChangeDataSource(defaultDataSource, index);
                                        }
                                    }, onRemoveQuery: () => {
                                        this.onRemoveQuery(query);
                                    } }));
                            }
                            return (React.createElement(QueryWrapper, { index: index, key: query.refId, dsSettings: dsSettings, data: data, error: error, query: query, onChangeQuery: this.onChangeQuery, onRemoveQuery: this.onRemoveQuery, queries: [...queries, ...expressions], onChangeDataSource: this.onChangeDataSource, onDuplicateQuery: this.props.onDuplicateQuery, onChangeTimeRange: this.onChangeTimeRange, onChangeQueryOptions: this.onChangeQueryOptions, thresholds: (_c = thresholdByRefId[query.refId]) === null || _c === void 0 ? void 0 : _c.config, thresholdsType: (_d = thresholdByRefId[query.refId]) === null || _d === void 0 ? void 0 : _d.mode, onRunQueries: this.props.onRunQueries, condition: this.props.condition, onSetCondition: this.props.onSetCondition }));
                        }),
                        provided.placeholder)));
            })));
    }
}
function copyModel(item, settings) {
    return Object.assign(Object.assign({}, item), { model: Object.assign(Object.assign({}, omit(item.model, 'datasource')), { datasource: {
                type: settings.type,
                uid: settings.uid,
            } }), datasourceUid: settings.uid });
}
function newModel(item, settings) {
    return {
        refId: item.refId,
        relativeTimeRange: item.relativeTimeRange,
        queryType: '',
        datasourceUid: settings.uid,
        model: {
            refId: item.refId,
            hide: false,
            datasource: {
                type: settings.type,
                uid: settings.uid,
            },
        },
    };
}
const DatasourceNotFound = ({ index, onUpdateDatasource, onRemoveQuery, model }) => {
    const refId = model.refId;
    const [showDetails, setShowDetails] = useState(false);
    const toggleDetails = () => {
        setShowDetails((show) => !show);
    };
    const handleUpdateDatasource = () => {
        onUpdateDatasource();
    };
    return (React.createElement(EmptyQueryWrapper, null,
        React.createElement(QueryOperationRow, { title: refId, draggable: true, index: index, id: refId, isOpen: true, collapsable: false },
            React.createElement(Card, null,
                React.createElement(Card.Heading, null, "This datasource has been removed"),
                React.createElement(Card.Description, null, "The datasource for this query was not found, it was either removed or is not installed correctly."),
                React.createElement(Card.Figure, null,
                    React.createElement(Icon, { name: "question-circle" })),
                React.createElement(Card.Actions, null,
                    React.createElement(Button, { key: "update", variant: "secondary", onClick: handleUpdateDatasource }, "Update datasource"),
                    React.createElement(Button, { key: "remove", variant: "destructive", onClick: onRemoveQuery }, "Remove query")),
                React.createElement(Card.SecondaryActions, null,
                    React.createElement(Button, { key: "details", onClick: toggleDetails, icon: showDetails ? 'angle-up' : 'angle-down', fill: "text", size: "sm" }, "Show details"))),
            showDetails && (React.createElement("div", null,
                React.createElement("pre", null,
                    React.createElement("code", null, JSON.stringify(model, null, 2))))))));
};
//# sourceMappingURL=QueryRows.js.map