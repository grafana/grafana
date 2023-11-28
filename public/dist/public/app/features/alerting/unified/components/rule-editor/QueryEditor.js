import { css } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { QueryRows } from './QueryRows';
export const QueryEditor = ({ queries, expressions, panelData, onRunQueries, onChangeQueries, onDuplicateQuery, condition, onSetCondition, }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.container },
        React.createElement(QueryRows, { data: panelData, queries: queries, expressions: expressions, onRunQueries: onRunQueries, onQueriesChange: onChangeQueries, onDuplicateQuery: onDuplicateQuery, condition: condition, onSetCondition: onSetCondition })));
};
const getStyles = (theme) => ({
    container: css `
    background-color: ${theme.colors.background.primary};
    height: 100%;
  `,
});
//# sourceMappingURL=QueryEditor.js.map