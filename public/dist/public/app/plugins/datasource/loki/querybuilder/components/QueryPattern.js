import { css } from '@emotion/css';
import React from 'react';
import { Button, Card, useStyles2 } from '@grafana/ui';
import { RawQuery } from 'app/plugins/datasource/prometheus/querybuilder/shared/RawQuery';
import logqlGrammar from '../../syntax';
import { lokiQueryModeller } from '../LokiQueryModeller';
export const QueryPattern = (props) => {
    const { pattern, onPatternSelect, hasNewQueryOption, hasPreviousQuery, selectedPatternName, setSelectedPatternName } = props;
    const styles = useStyles2(getStyles);
    const lang = { grammar: logqlGrammar, name: 'logql' };
    return (React.createElement(Card, { className: styles.card },
        React.createElement(Card.Heading, null, pattern.name),
        React.createElement("div", { className: styles.rawQueryContainer },
            React.createElement(RawQuery, { query: lokiQueryModeller.renderQuery({ labels: [], operations: pattern.operations }), lang: lang, className: styles.rawQuery })),
        React.createElement(Card.Actions, null, selectedPatternName !== pattern.name ? (React.createElement(Button, { size: "sm", onClick: () => {
                if (hasPreviousQuery) {
                    // If user has previous query, we need to confirm that they want to replace it
                    setSelectedPatternName(pattern.name);
                }
                else {
                    onPatternSelect(pattern);
                }
            } }, "Use this query")) : (React.createElement(React.Fragment, null,
            React.createElement("div", { className: styles.spacing }, `If you would like to use this query, ${hasNewQueryOption
                ? 'you can either replace your current query or create a new query'
                : 'your current query will be replaced'}.`),
            React.createElement(Button, { size: "sm", fill: "outline", onClick: () => setSelectedPatternName(null) }, "Back"),
            React.createElement(Button, { size: "sm", onClick: () => {
                    onPatternSelect(pattern);
                } }, "Replace query"),
            hasNewQueryOption && (React.createElement(Button, { size: "sm", onClick: () => {
                    onPatternSelect(pattern, true);
                } }, "Create new query")))))));
};
const getStyles = (theme) => {
    return {
        card: css `
      width: 49.5%;
      display: flex;
      flex-direction: column;
    `,
        rawQueryContainer: css `
      flex-grow: 1;
    `,
        rawQuery: css `
      background-color: ${theme.colors.background.primary};
      padding: ${theme.spacing(1)};
      margin-top: ${theme.spacing(1)};
    `,
        spacing: css `
      margin-bottom: ${theme.spacing(1)};
    `,
    };
};
//# sourceMappingURL=QueryPattern.js.map