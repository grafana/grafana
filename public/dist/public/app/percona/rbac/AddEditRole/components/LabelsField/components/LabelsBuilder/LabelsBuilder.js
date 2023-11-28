import React, { useMemo, useState } from 'react';
import { getDataSourceSrv } from '@grafana/runtime';
import { PrometheusDatasource } from 'app/plugins/datasource/prometheus/datasource';
import { promQueryModeller } from 'app/plugins/datasource/prometheus/querybuilder/PromQueryModeller';
import { PromQueryBuilder } from 'app/plugins/datasource/prometheus/querybuilder/components/PromQueryBuilder';
import { QueryPreview } from 'app/plugins/datasource/prometheus/querybuilder/components/QueryPreview';
import { buildVisualQueryFromString } from 'app/plugins/datasource/prometheus/querybuilder/parsing';
import { styles } from './LabelsBuilder.styles';
const LabelsBuilder = ({ value, onChange }) => {
    const source = getDataSourceSrv().getInstanceSettings();
    const datasource = source ? new PrometheusDatasource(source) : undefined;
    const [query, setQuery] = useState({
        refId: '',
        expr: value,
    });
    const visualQuery = useMemo(() => buildVisualQueryFromString(query.expr).query, [query.expr]);
    if (!datasource) {
        return null;
    }
    const handleQueryChange = (visualQuery) => {
        const expr = promQueryModeller.renderQuery(visualQuery);
        onChange(expr);
        setQuery((prev) => (Object.assign(Object.assign({}, prev), { expr })));
    };
    return (React.createElement("div", { className: styles.QueryBuilder },
        React.createElement(PromQueryBuilder, { datasource: datasource, onChange: handleQueryChange, onRunQuery: console.log, query: visualQuery, showExplain: false, hideMetric: true, hideOperations: true }),
        React.createElement("div", null),
        query.expr && React.createElement(QueryPreview, { query: query.expr })));
};
export default LabelsBuilder;
//# sourceMappingURL=LabelsBuilder.js.map