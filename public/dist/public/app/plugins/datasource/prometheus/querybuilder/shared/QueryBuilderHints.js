import { css } from '@emotion/css';
import React, { useState, useEffect } from 'react';
import { reportInteraction } from '@grafana/runtime';
import { Button, Tooltip, useStyles2 } from '@grafana/ui';
export const QueryBuilderHints = ({ datasource, query: visualQuery, onChange, data, queryModeller, buildVisualQueryFromString, }) => {
    const [hints, setHints] = useState([]);
    const styles = useStyles2(getStyles);
    useEffect(() => {
        const query = { expr: queryModeller.renderQuery(visualQuery), refId: '' };
        // For now show only actionable hints
        const hints = datasource.getQueryHints(query, (data === null || data === void 0 ? void 0 : data.series) || []).filter((hint) => { var _a; return (_a = hint.fix) === null || _a === void 0 ? void 0 : _a.action; });
        setHints(hints);
    }, [datasource, visualQuery, data, queryModeller]);
    return (React.createElement(React.Fragment, null, hints.length > 0 && (React.createElement("div", { className: styles.container }, hints.map((hint) => {
        var _a, _b, _c, _d;
        return (React.createElement(Tooltip, { content: `${hint.label} ${(_a = hint.fix) === null || _a === void 0 ? void 0 : _a.label}`, key: hint.type },
            React.createElement(Button, { onClick: () => {
                    var _a;
                    reportInteraction('grafana_query_builder_hints_clicked', {
                        hint: hint.type,
                        datasourceType: datasource.type,
                    });
                    if ((_a = hint === null || hint === void 0 ? void 0 : hint.fix) === null || _a === void 0 ? void 0 : _a.action) {
                        const query = { expr: queryModeller.renderQuery(visualQuery), refId: '' };
                        const newQuery = datasource.modifyQuery(query, hint.fix.action);
                        const newVisualQuery = buildVisualQueryFromString(newQuery.expr);
                        return onChange(newVisualQuery.query);
                    }
                }, fill: "outline", size: "sm", className: styles.hint },
                "hint: ",
                ((_b = hint.fix) === null || _b === void 0 ? void 0 : _b.title) || ((_d = (_c = hint.fix) === null || _c === void 0 ? void 0 : _c.action) === null || _d === void 0 ? void 0 : _d.type.toLowerCase().replace('_', ' ')))));
    })))));
};
QueryBuilderHints.displayName = 'QueryBuilderHints';
const getStyles = (theme) => {
    return {
        container: css `
      display: flex;
      align-items: start;
    `,
        hint: css `
      margin-right: ${theme.spacing(1)};
    `,
    };
};
//# sourceMappingURL=QueryBuilderHints.js.map