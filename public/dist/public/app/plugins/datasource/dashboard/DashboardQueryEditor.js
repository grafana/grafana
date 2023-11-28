import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import { useId } from '@react-aria/utils';
import pluralize from 'pluralize';
import React, { useCallback, useMemo } from 'react';
import { useAsync } from 'react-use';
import { DataTopic } from '@grafana/data';
import { Card, Field, Select, useStyles2, VerticalGroup, HorizontalGroup, Spinner, Switch, RadioButtonGroup, } from '@grafana/ui';
import config from 'app/core/config';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { filterPanelDataToQuery } from 'app/features/query/components/QueryEditorRow';
import { SHARED_DASHBOARD_QUERY } from './types';
function getQueryDisplayText(query) {
    return JSON.stringify(query);
}
const topics = [
    { label: 'All data', value: false },
    { label: 'Annotations', value: true, description: 'Include annotations as regular data' },
];
export function DashboardQueryEditor({ panelData, queries, onChange, onRunQueries }) {
    var _a;
    const { value: defaultDatasource } = useAsync(() => getDatasourceSrv().get());
    const query = queries[0];
    const panel = useMemo(() => {
        var _a;
        const dashboard = getDashboardSrv().getCurrent();
        return dashboard === null || dashboard === void 0 ? void 0 : dashboard.getPanelById((_a = query.panelId) !== null && _a !== void 0 ? _a : -124134);
    }, [query.panelId]);
    const { value: results, loading: loadingResults } = useAsync(() => __awaiter(this, void 0, void 0, function* () {
        if (!panel) {
            return [];
        }
        const mainDS = yield getDatasourceSrv().get(panel.datasource);
        return Promise.all(panel.targets.map((query) => __awaiter(this, void 0, void 0, function* () {
            var _b;
            const ds = query.datasource ? yield getDatasourceSrv().get(query.datasource) : mainDS;
            const fmt = ds.getQueryDisplayText || getQueryDisplayText;
            const queryData = (_b = filterPanelDataToQuery(panelData, query.refId)) !== null && _b !== void 0 ? _b : panelData;
            return {
                refId: query.refId,
                query: fmt(query),
                name: ds.name,
                img: ds.meta.info.logos.small,
                data: queryData.series,
                error: queryData.error,
            };
        })));
    }), [panelData, panel]);
    const onUpdateQuery = useCallback((query) => {
        onChange([query]);
        onRunQueries();
    }, [onChange, onRunQueries]);
    const onPanelChanged = useCallback((id) => {
        onUpdateQuery(Object.assign(Object.assign({}, query), { panelId: id }));
    }, [query, onUpdateQuery]);
    const onTransformToggle = useCallback(() => {
        onUpdateQuery(Object.assign(Object.assign({}, query), { withTransforms: !query.withTransforms }));
    }, [query, onUpdateQuery]);
    const onTopicChanged = useCallback((t) => {
        onUpdateQuery(Object.assign(Object.assign({}, query), { topic: t ? DataTopic.Annotations : undefined }));
    }, [query, onUpdateQuery]);
    const getPanelDescription = useCallback((panel) => {
        var _a, _b;
        const datasource = (_a = panel.datasource) !== null && _a !== void 0 ? _a : defaultDatasource;
        const dsname = (_b = getDatasourceSrv().getInstanceSettings(datasource)) === null || _b === void 0 ? void 0 : _b.name;
        const queryCount = panel.targets.length;
        return `${queryCount} ${pluralize('query', queryCount)} to ${dsname}`;
    }, [defaultDatasource]);
    const dashboard = getDashboardSrv().getCurrent();
    const showTransforms = Boolean(query.withTransforms || ((_a = panel === null || panel === void 0 ? void 0 : panel.transformations) === null || _a === void 0 ? void 0 : _a.length));
    const panels = useMemo(() => {
        var _a;
        return (_a = dashboard === null || dashboard === void 0 ? void 0 : dashboard.panels.filter((panel) => {
            var _a, _b;
            return config.panels[panel.type] &&
                panel.targets &&
                panel.id !== ((_a = dashboard.panelInEdit) === null || _a === void 0 ? void 0 : _a.id) &&
                ((_b = panel.datasource) === null || _b === void 0 ? void 0 : _b.uid) !== SHARED_DASHBOARD_QUERY;
        }).map((panel) => {
            var _a;
            return ({
                value: panel.id,
                label: (_a = panel.title) !== null && _a !== void 0 ? _a : 'Panel ' + panel.id,
                description: getPanelDescription(panel),
                imgUrl: config.panels[panel.type].info.logos.small,
            });
        })) !== null && _a !== void 0 ? _a : [];
    }, [dashboard, getPanelDescription]);
    const styles = useStyles2(getStyles);
    const selectId = useId();
    if (!dashboard) {
        return null;
    }
    if (panels.length < 1) {
        return (React.createElement("p", { className: styles.noQueriesText }, "This dashboard does not have any other panels. Add queries to other panels and try again."));
    }
    const selected = panels.find((panel) => panel.value === query.panelId);
    return (React.createElement(React.Fragment, null,
        React.createElement(Field, { label: "Source", description: "Use the same results as panel" },
            React.createElement(Select, { inputId: selectId, placeholder: "Choose panel", isSearchable: true, options: panels, value: selected, onChange: (item) => onPanelChanged(item.value) })),
        React.createElement(HorizontalGroup, { height: "auto", wrap: true, align: "flex-start" },
            React.createElement(Field, { label: "Data Source", description: "Use data or annotations from the panel", className: styles.horizontalField },
                React.createElement(RadioButtonGroup, { options: topics, value: query.topic === DataTopic.Annotations, onChange: onTopicChanged })),
            showTransforms && (React.createElement(Field, { label: "Transform", description: "Apply panel transformations from the source panel" },
                React.createElement(Switch, { value: Boolean(query.withTransforms), onChange: onTransformToggle })))),
        loadingResults ? (React.createElement(Spinner, null)) : (React.createElement(React.Fragment, null, results && Boolean(results.length) && (React.createElement(Field, { label: "Queries from panel" },
            React.createElement(VerticalGroup, { spacing: "sm" }, results.map((target, i) => (React.createElement(Card, { key: `DashboardQueryRow-${i}` },
                React.createElement(Card.Heading, null, target.refId),
                React.createElement(Card.Figure, null,
                    React.createElement("img", { src: target.img, alt: target.name, title: target.name, width: 40 })),
                React.createElement(Card.Meta, null, target.query)))))))))));
}
function getStyles(theme) {
    return {
        horizontalField: css({
            marginRight: theme.spacing(2),
        }),
        noQueriesText: css({
            padding: theme.spacing(1.25),
        }),
    };
}
//# sourceMappingURL=DashboardQueryEditor.js.map