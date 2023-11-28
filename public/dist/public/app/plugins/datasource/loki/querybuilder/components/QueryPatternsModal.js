import { css } from '@emotion/css';
import { capitalize } from 'lodash';
import React, { useMemo, useState } from 'react';
import { reportInteraction } from '@grafana/runtime';
import { Button, Collapse, Modal, useStyles2 } from '@grafana/ui';
import { getNextRefIdChar } from 'app/core/utils/query';
import { lokiQueryModeller } from '../LokiQueryModeller';
import { buildVisualQueryFromString } from '../parsing';
import { LokiQueryPatternType } from '../types';
import { QueryPattern } from './QueryPattern';
export const QueryPatternsModal = (props) => {
    const { isOpen, onClose, onChange, onAddQuery, query, queries, app } = props;
    const [openTabs, setOpenTabs] = useState([]);
    const [selectedPatternName, setSelectedPatternName] = useState(null);
    const styles = useStyles2(getStyles);
    const hasNewQueryOption = !!onAddQuery;
    const hasPreviousQuery = useMemo(() => buildVisualQueryFromString(query.expr).query.operations.length > 0, [query.expr]);
    const onPatternSelect = (pattern, selectAsNewQuery = false) => {
        const visualQuery = buildVisualQueryFromString(selectAsNewQuery ? '' : query.expr);
        reportInteraction('grafana_loki_query_patterns_selected', {
            version: 'v2',
            app: app !== null && app !== void 0 ? app : '',
            editorMode: query.editorMode,
            selectedPattern: pattern.name,
            preSelectedOperationsCount: visualQuery.query.operations.length,
            preSelectedLabelsCount: visualQuery.query.labels.length,
            createNewQuery: hasNewQueryOption && selectAsNewQuery,
        });
        visualQuery.query.operations = pattern.operations;
        if (hasNewQueryOption && selectAsNewQuery) {
            onAddQuery(Object.assign(Object.assign({}, query), { refId: getNextRefIdChar(queries !== null && queries !== void 0 ? queries : [query]), expr: lokiQueryModeller.renderQuery(visualQuery.query) }));
        }
        else {
            onChange(Object.assign(Object.assign({}, query), { expr: lokiQueryModeller.renderQuery(visualQuery.query) }));
        }
        setSelectedPatternName(null);
        onClose();
    };
    return (React.createElement(Modal, { isOpen: isOpen, title: "Kick start your query", onDismiss: onClose, className: styles.modal },
        React.createElement("div", { className: styles.spacing }, "Kick start your query by selecting one of these queries. You can then continue to complete your query."),
        Object.values(LokiQueryPatternType).map((patternType) => {
            return (React.createElement(Collapse, { key: patternType, label: `${capitalize(patternType)} query starters`, isOpen: openTabs.includes(patternType), collapsible: true, onToggle: () => setOpenTabs((tabs) => 
                // close tab if it's already open, otherwise open it
                tabs.includes(patternType) ? tabs.filter((t) => t !== patternType) : [...tabs, patternType]) },
                React.createElement("div", { className: styles.cardsContainer }, lokiQueryModeller
                    .getQueryPatterns()
                    .filter((pattern) => pattern.type === patternType)
                    .map((pattern) => (React.createElement(QueryPattern, { key: pattern.name, pattern: pattern, hasNewQueryOption: hasNewQueryOption, hasPreviousQuery: hasPreviousQuery, onPatternSelect: onPatternSelect, selectedPatternName: selectedPatternName, setSelectedPatternName: setSelectedPatternName }))))));
        }),
        React.createElement(Button, { variant: "secondary", onClick: onClose }, "Close")));
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
        modal: css `
      width: 85vw;
      ${theme.breakpoints.down('md')} {
        width: 100%;
      }
    `,
    };
};
//# sourceMappingURL=QueryPatternsModal.js.map