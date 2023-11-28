import { css } from '@emotion/css';
import React from 'react';
import { Button, Card, useStyles2 } from '@grafana/ui';
import { RawQuery } from 'app/plugins/datasource/prometheus/querybuilder/shared/RawQuery';
import promqlGrammar from '../promql';
import { promQueryModeller } from './PromQueryModeller';
export const QueryPattern = (props) => {
    const { pattern, onPatternSelect, hasNewQueryOption, hasPreviousQuery, selectedPatternName, setSelectedPatternName } = props;
    const styles = useStyles2(getStyles);
    const lang = { grammar: promqlGrammar, name: 'promql' };
    return (React.createElement(Card, { className: styles.card },
        React.createElement(Card.Heading, null, pattern.name),
        React.createElement("div", { className: styles.rawQueryContainer },
            React.createElement(RawQuery, { "aria-label": `${pattern.name} raw query`, query: promQueryModeller.renderQuery({
                    labels: [],
                    operations: pattern.operations,
                    binaryQueries: pattern.binaryQueries,
                }), lang: lang, className: styles.rawQuery })),
        React.createElement(Card.Actions, null, selectedPatternName !== pattern.name ? (React.createElement(Button, { size: "sm", "aria-label": "use this query button", onClick: () => {
                if (hasPreviousQuery) {
                    // If user has previous query, we need to confirm that they want to apply this query pattern
                    setSelectedPatternName(pattern.name);
                }
                else {
                    onPatternSelect(pattern);
                }
            } }, "Use this query")) : (React.createElement(React.Fragment, null,
            React.createElement("div", { className: styles.spacing }, `If you would like to use this query, ${hasNewQueryOption
                ? 'you can either apply this query pattern or create a new query'
                : 'this query pattern will be applied to your current query'}.`),
            React.createElement(Button, { size: "sm", "aria-label": "back button", fill: "outline", onClick: () => setSelectedPatternName(null) }, "Back"),
            React.createElement(Button, { size: "sm", "aria-label": "apply query starter button", onClick: () => {
                    onPatternSelect(pattern);
                } }, "Apply query"),
            hasNewQueryOption && (React.createElement(Button, { size: "sm", "aria-label": "create new query button", onClick: () => {
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