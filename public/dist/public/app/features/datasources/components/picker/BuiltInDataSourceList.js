import React from 'react';
import { t } from 'app/core/internationalization';
import { useDatasources } from '../../hooks';
import { DataSourceCard } from './DataSourceCard';
import { isDataSourceMatch } from './utils';
const CUSTOM_DESCRIPTIONS_BY_UID = {
    grafana: t('data-source-picker.built-in-list.description-grafana', 'Discover visualizations using mock data'),
    '-- Mixed --': t('data-source-picker.built-in-list.description-mixed', 'Use multiple data sources'),
    '-- Dashboard --': t('data-source-picker.built-in-list.description-dashboard', 'Reuse query results from other visualizations'),
};
export function BuiltInDataSourceList({ className, current, onChange, tracing, dashboard, mixed, metrics, type, annotations, variables, alerting, pluginId, logs, filter, }) {
    const grafanaDataSources = useDatasources({
        tracing,
        dashboard,
        mixed,
        metrics,
        type,
        annotations,
        variables,
        alerting,
        pluginId,
        logs,
    });
    const filteredResults = grafanaDataSources.filter((ds) => (filter ? filter === null || filter === void 0 ? void 0 : filter(ds) : true) && !!ds.meta.builtIn);
    return (React.createElement("div", { className: className, "data-testid": "built-in-data-sources-list" }, filteredResults.map((ds) => {
        return (React.createElement(DataSourceCard, { key: ds.uid, ds: ds, description: CUSTOM_DESCRIPTIONS_BY_UID[ds.uid], selected: isDataSourceMatch(ds, current), onClick: () => onChange(ds) }));
    })));
}
//# sourceMappingURL=BuiltInDataSourceList.js.map