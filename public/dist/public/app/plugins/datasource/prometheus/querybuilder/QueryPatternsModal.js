import { css } from '@emotion/css';
import { capitalize } from 'lodash';
import React, { useMemo, useState } from 'react';
import { reportInteraction } from '@grafana/runtime';
import { Button, Collapse, Modal, useStyles2 } from '@grafana/ui';
import { getNextRefIdChar } from 'app/core/utils/query';
import { promQueryModeller } from './PromQueryModeller';
import { QueryPattern } from './QueryPattern';
import { buildVisualQueryFromString } from './parsing';
import { PromQueryPatternType } from './types';
export const QueryPatternsModal = (props) => {
    const { isOpen, onClose, onChange, onAddQuery, query, queries, app } = props;
    const [openTabs, setOpenTabs] = useState([]);
    const [selectedPatternName, setSelectedPatternName] = useState(null);
    const styles = useStyles2(getStyles);
    const hasNewQueryOption = !!onAddQuery;
    const hasPreviousQuery = useMemo(() => {
        var _a;
        const visualQuery = buildVisualQueryFromString((_a = query.expr) !== null && _a !== void 0 ? _a : '');
        // has anything entered in the query, metric, labels, operations, or binary queries
        const hasOperations = visualQuery.query.operations.length > 0, hasMetric = visualQuery.query.metric, hasLabels = visualQuery.query.labels.length > 0, hasBinaryQueries = visualQuery.query.binaryQueries ? visualQuery.query.binaryQueries.length > 0 : false;
        return hasOperations || hasMetric || hasLabels || hasBinaryQueries;
    }, [query.expr]);
    const onPatternSelect = (pattern, selectAsNewQuery = false) => {
        const visualQuery = buildVisualQueryFromString(selectAsNewQuery ? '' : query.expr);
        reportInteraction('grafana_prom_kickstart_your_query_selected', {
            app: app !== null && app !== void 0 ? app : '',
            editorMode: query.editorMode,
            selectedPattern: pattern.name,
            preSelectedOperationsCount: visualQuery.query.operations.length,
            preSelectedLabelsCount: visualQuery.query.labels.length,
            createNewQuery: hasNewQueryOption && selectAsNewQuery,
        });
        visualQuery.query.operations = pattern.operations;
        visualQuery.query.binaryQueries = pattern.binaryQueries;
        if (hasNewQueryOption && selectAsNewQuery) {
            onAddQuery(Object.assign(Object.assign({}, query), { refId: getNextRefIdChar(queries !== null && queries !== void 0 ? queries : [query]), expr: promQueryModeller.renderQuery(visualQuery.query) }));
        }
        else {
            onChange(Object.assign(Object.assign({}, query), { expr: promQueryModeller.renderQuery(visualQuery.query) }));
        }
        setSelectedPatternName(null);
        onClose();
    };
    return (React.createElement(Modal, { "aria-label": "Kick start your query modal", isOpen: isOpen, title: "Kick start your query", onDismiss: onClose },
        React.createElement("div", { className: styles.spacing }, "Kick start your query by selecting one of these queries. You can then continue to complete your query."),
        Object.values(PromQueryPatternType).map((patternType) => {
            return (React.createElement(Collapse, { "aria-label": `open and close ${patternType} query starter card`, key: patternType, label: `${capitalize(patternType)} query starters`, isOpen: openTabs.includes(patternType), collapsible: true, onToggle: () => setOpenTabs((tabs) => 
                // close tab if it's already open, otherwise open it
                tabs.includes(patternType) ? tabs.filter((t) => t !== patternType) : [...tabs, patternType]) },
                React.createElement("div", { className: styles.cardsContainer }, promQueryModeller
                    .getQueryPatterns()
                    .filter((pattern) => pattern.type === patternType)
                    .map((pattern) => (React.createElement(QueryPattern, { key: pattern.name, pattern: pattern, hasNewQueryOption: hasNewQueryOption, hasPreviousQuery: hasPreviousQuery, onPatternSelect: onPatternSelect, selectedPatternName: selectedPatternName, setSelectedPatternName: setSelectedPatternName }))))));
        }),
        React.createElement(Button, { "aria-label": "close kick start your query modal", variant: "secondary", onClick: onClose }, "Close")));
};
const getStyles = (theme) => {
    return {
        cardsContainer: css `
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: space-between;
    `,
        spacing: css `
      margin-bottom: ${theme.spacing(1)};
    `,
    };
};
//# sourceMappingURL=QueryPatternsModal.js.map